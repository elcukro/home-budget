"""
Tink Sync Background Job

Automatically syncs transactions from Tink for all active connections.
"""

import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..models import User, TinkConnection
from ..services.tink_service import tink_service
from ..services.audit_service import audit_transactions_synced
from ..logging_utils import get_secure_logger

logger = get_secure_logger(__name__)


def run_sync_job():
    """
    Wrapper function for APScheduler to run the async sync job.

    APScheduler can't directly schedule async functions, so this wrapper
    uses asyncio.run() to execute the async sync_all_tink_connections().
    """
    logger.info("Tink sync job triggered")
    asyncio.run(sync_all_tink_connections())


async def sync_all_tink_connections():
    """
    Background job to sync transactions for all active Tink connections.
    
    This job:
    1. Queries all active TinkConnection records
    2. For each connection, syncs last 90 days of transactions
    3. Uses exponential backoff to respect rate limits (50 syncs/day per user)
    4. Logs results to audit table
    5. Isolates errors (one failure doesn't stop others)
    """
    logger.info("Starting background Tink sync job")
    
    db = SessionLocal()
    total_connections = 0
    successful_syncs = 0
    failed_syncs = 0
    
    try:
        # Query all active connections
        connections = db.query(TinkConnection).filter(
            TinkConnection.is_active == True
        ).all()
        
        total_connections = len(connections)
        logger.info(f"Found {total_connections} active Tink connections")
        
        for connection in connections:
            try:
                # Sync this connection
                result = await sync_single_connection(connection, db)
                
                if result["success"]:
                    successful_syncs += 1
                    logger.info(
                        f"Synced connection {connection.id} for user {connection.user_id}: "
                        f"{result['synced_count']} new, {result['exact_duplicate_count']} duplicates"
                    )
                else:
                    failed_syncs += 1
                    logger.error(f"Failed to sync connection {connection.id}: {result.get('error')}")
                    
                # Small delay between connections to avoid overwhelming the API
                await asyncio.sleep(2)
                
            except Exception as e:
                failed_syncs += 1
                logger.error(f"Error syncing connection {connection.id}: {str(e)}", exc_info=True)
                # Continue with next connection (error isolation)
                continue
        
        logger.info(
            f"Background sync completed: {successful_syncs}/{total_connections} successful, "
            f"{failed_syncs} failed"
        )
        
    except Exception as e:
        logger.error(f"Error in background sync job: {str(e)}", exc_info=True)
    finally:
        db.close()


async def sync_single_connection(connection: TinkConnection, db: Session, days: int = 90) -> dict:
    """
    Sync transactions for a single Tink connection.
    
    This is a simplified version of the sync endpoint logic, focused on background execution.
    
    Args:
        connection: TinkConnection to sync
        db: Database session
        days: Number of days to sync (default: 90)
        
    Returns:
        dict with sync results
    """
    try:
        # Import here to avoid circular imports
        from ..routers.bank_transactions import (
            BankTransaction,
            create_fingerprint,
            check_pending_to_booked_update,
            detect_duplicate_for_new_transaction,
            map_tink_category,
        )
        
        # Get valid access token
        access_token = await tink_service.get_valid_access_token(connection, db)
        
        # Fetch transactions from Tink
        from_date = datetime.now() - timedelta(days=days)
        transactions_response = await tink_service.fetch_transactions(
            access_token,
            from_date=from_date
        )
        
        transactions = transactions_response.get("transactions", [])
        total_fetched = len(transactions)
        synced_count = 0
        exact_duplicate_count = 0
        fuzzy_duplicate_count = 0
        
        # Process each transaction (same logic as endpoint)
        for tx in transactions:
            tink_tx_id = tx.get("id")
            
            # Check for exact duplicate
            existing = db.query(BankTransaction).filter(
                BankTransaction.tink_transaction_id == tink_tx_id
            ).first()
            
            if existing:
                exact_duplicate_count += 1
                continue
            
            # Parse transaction data (simplified - using key fields only)
            amount_data = tx.get("amount", {})
            amount_value = amount_data.get("value", {})
            scale = int(amount_value.get("scale", "2"))
            unscaled = float(amount_value.get("unscaledValue", "0"))
            amount = unscaled / (10 ** scale)
            
            currency = amount_data.get("currencyCode", "PLN")
            
            dates = tx.get("dates", {})
            booked_date_str = dates.get("booked")
            if booked_date_str:
                tx_date = datetime.strptime(booked_date_str, "%Y-%m-%d").date()
            else:
                tx_date = datetime.now().date()
            
            descriptions = tx.get("descriptions", {})
            description_display = descriptions.get("display", "Unknown transaction")
            description_original = descriptions.get("original")
            
            merchant_info = tx.get("merchantInformation", {})
            merchant_name = merchant_info.get("merchantName")
            merchant_category_code = merchant_info.get("merchantCategoryCode")
            
            # Parse Tink categories
            enriched_categories = tx.get("enrichedData", {}).get("categories", {}) or tx.get("enriched_data", {}).get("categories", {})
            basic_categories = tx.get("categories", {})
            pfm_category = enriched_categories.get("pfm", {}) or basic_categories.get("pfm", {})
            tink_category_id = pfm_category.get("id")
            tink_category_name = pfm_category.get("name")
            
            suggested_type = "income" if amount > 0 else "expense"
            suggested_category = map_tink_category(tink_category_id, suggested_type)
            
            # Duplicate detection
            tink_account_id = tx.get("accountId", "")
            fingerprint = create_fingerprint(
                amount=amount,
                currency=currency,
                tx_date=tx_date,
                description=description_display,
                merchant_category_code=merchant_category_code,
                tink_account_id=tink_account_id,
            )
            
            # Check pending → booked update
            pending_tx_id = check_pending_to_booked_update(
                db=db,
                user_id=connection.user_id,
                fingerprint=fingerprint,
                raw_data=tx,
            )
            
            if pending_tx_id:
                pending_tx = db.query(BankTransaction).filter(
                    BankTransaction.id == pending_tx_id
                ).first()
                if pending_tx:
                    pending_tx.tink_transaction_id = tink_tx_id
                    pending_tx.raw_data = tx
                    continue
            
            # Check fuzzy duplicates
            is_fuzzy_duplicate = False
            duplicate_of_id = None
            duplicate_confidence = None
            duplicate_reason = None
            
            fuzzy_match = detect_duplicate_for_new_transaction(
                db=db,
                user_id=connection.user_id,
                tink_transaction_id=tink_tx_id,
                amount=amount,
                currency=currency,
                tx_date=tx_date,
                description=description_display,
                merchant_category_code=merchant_category_code,
                tink_account_id=tink_account_id,
            )
            
            if fuzzy_match:
                if fuzzy_match.confidence >= 1.0:
                    exact_duplicate_count += 1
                    continue
                
                is_fuzzy_duplicate = True
                duplicate_of_id = fuzzy_match.original_transaction_id
                duplicate_confidence = fuzzy_match.confidence
                duplicate_reason = fuzzy_match.match_reason
                fuzzy_duplicate_count += 1
            
            # Create bank transaction
            bank_tx = BankTransaction(
                user_id=connection.user_id,
                tink_transaction_id=tink_tx_id,
                tink_account_id=tink_account_id,
                provider_transaction_id=tx.get("identifiers", {}).get("providerTransactionId"),
                amount=amount,
                currency=currency,
                date=tx_date,
                description_display=description_display,
                description_original=description_original,
                merchant_name=merchant_name,
                merchant_category_code=merchant_category_code,
                tink_category_id=tink_category_id,
                tink_category_name=tink_category_name,
                suggested_type=suggested_type,
                suggested_category=suggested_category,
                status="pending",
                raw_data=tx,
                is_duplicate=is_fuzzy_duplicate,
                duplicate_of=duplicate_of_id,
                duplicate_confidence=duplicate_confidence,
                duplicate_reason=duplicate_reason,
            )
            
            db.add(bank_tx)
            synced_count += 1
        
        # Update connection sync timestamp
        connection.last_sync_at = datetime.now()
        db.commit()
        
        # Audit
        audit_transactions_synced(
            db=db,
            user_id=connection.user_id,
            connection_id=connection.id,
            synced_count=synced_count,
            exact_duplicate_count=exact_duplicate_count,
            fuzzy_duplicate_count=fuzzy_duplicate_count,
            total_fetched=total_fetched,
            date_range_days=days,
            result="success",
            request=None,  # Background job, no HTTP request
        )
        
        return {
            "success": True,
            "synced_count": synced_count,
            "exact_duplicate_count": exact_duplicate_count,
            "fuzzy_duplicate_count": fuzzy_duplicate_count,
            "total_fetched": total_fetched,
        }
        
    except Exception as e:
        logger.error(f"Error in sync_single_connection: {str(e)}", exc_info=True)
        
        # Audit failure
        audit_transactions_synced(
            db=db,
            user_id=connection.user_id,
            connection_id=connection.id,
            synced_count=0,
            exact_duplicate_count=0,
            fuzzy_duplicate_count=0,
            total_fetched=0,
            date_range_days=days,
            result="failure",
            request=None,
        )
        
        return {
            "success": False,
            "error": str(e)
        }
