"""Add duplicate detection fields to bank_transactions

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-02-05 14:00:00.000000

This migration adds:
- duplicate_confidence: Float field for fuzzy duplicate confidence score (0-1)
- duplicate_reason: String field explaining why a transaction was flagged as duplicate
- idx_bank_tx_duplicate_lookup: Composite index for efficient duplicate detection queries
- idx_bank_transactions_is_duplicate: Index on is_duplicate flag
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6g7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add duplicate detection fields and indexes to bank_transactions."""
    # Add new columns for duplicate detection
    op.add_column(
        'bank_transactions',
        sa.Column('duplicate_confidence', sa.Float(), nullable=True,
                  comment='Confidence score (0-1) that this is a duplicate')
    )
    op.add_column(
        'bank_transactions',
        sa.Column('duplicate_reason', sa.String(), nullable=True,
                  comment='Reason for duplicate flag (e.g., same_account_exact_match)')
    )

    # Add composite index for efficient duplicate detection queries
    # This index helps when searching for potential duplicates by user, date, and currency
    op.create_index(
        'idx_bank_tx_duplicate_lookup',
        'bank_transactions',
        ['user_id', 'date', 'currency'],
        unique=False
    )

    # Add index on is_duplicate flag for filtering
    op.create_index(
        'idx_bank_transactions_is_duplicate',
        'bank_transactions',
        ['is_duplicate'],
        unique=False
    )


def downgrade() -> None:
    """Remove duplicate detection fields and indexes."""
    # Drop indexes first
    op.drop_index('idx_bank_transactions_is_duplicate', table_name='bank_transactions')
    op.drop_index('idx_bank_tx_duplicate_lookup', table_name='bank_transactions')

    # Drop columns
    op.drop_column('bank_transactions', 'duplicate_reason')
    op.drop_column('bank_transactions', 'duplicate_confidence')
