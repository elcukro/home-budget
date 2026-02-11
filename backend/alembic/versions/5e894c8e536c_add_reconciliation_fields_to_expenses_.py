"""add_reconciliation_fields_to_expenses_and_income

Revision ID: 5e894c8e536c
Revises: e8f9a1b2c3d4
Create Date: 2026-02-11 12:45:57.410254

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5e894c8e536c'
down_revision: Union[str, Sequence[str], None] = 'e8f9a1b2c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add reconciliation fields to expenses table
    op.add_column('expenses', sa.Column('reconciliation_status', sa.String(), server_default='unreviewed', nullable=False, comment='unreviewed | bank_backed | manual_confirmed | duplicate_of_bank | pre_bank_era'))
    op.add_column('expenses', sa.Column('duplicate_bank_transaction_id', sa.Integer(), nullable=True, comment='If marked as duplicate, links to the bank transaction it duplicates'))
    op.add_column('expenses', sa.Column('reconciliation_note', sa.String(), nullable=True))
    op.add_column('expenses', sa.Column('reconciliation_reviewed_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('idx_expenses_reconciliation_status', 'expenses', ['reconciliation_status'], unique=False)
    op.create_index('idx_expenses_source_status', 'expenses', ['source', 'reconciliation_status'], unique=False)
    op.create_foreign_key('fk_expense_duplicate_bank_tx', 'expenses', 'bank_transactions', ['duplicate_bank_transaction_id'], ['id'])

    # Add reconciliation fields to income table
    op.add_column('income', sa.Column('reconciliation_status', sa.String(), server_default='unreviewed', nullable=False, comment='unreviewed | bank_backed | manual_confirmed | duplicate_of_bank | pre_bank_era'))
    op.add_column('income', sa.Column('duplicate_bank_transaction_id', sa.Integer(), nullable=True, comment='If marked as duplicate, links to the bank transaction it duplicates'))
    op.add_column('income', sa.Column('reconciliation_note', sa.String(), nullable=True))
    op.add_column('income', sa.Column('reconciliation_reviewed_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('idx_income_reconciliation_status', 'income', ['reconciliation_status'], unique=False)
    op.create_index('idx_income_source_status', 'income', ['source', 'reconciliation_status'], unique=False)
    op.create_foreign_key('fk_income_duplicate_bank_tx', 'income', 'bank_transactions', ['duplicate_bank_transaction_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Remove reconciliation fields from income table
    op.drop_constraint('fk_income_duplicate_bank_tx', 'income', type_='foreignkey')
    op.drop_index('idx_income_source_status', table_name='income')
    op.drop_index('idx_income_reconciliation_status', table_name='income')
    op.drop_column('income', 'reconciliation_reviewed_at')
    op.drop_column('income', 'reconciliation_note')
    op.drop_column('income', 'duplicate_bank_transaction_id')
    op.drop_column('income', 'reconciliation_status')

    # Remove reconciliation fields from expenses table
    op.drop_constraint('fk_expense_duplicate_bank_tx', 'expenses', type_='foreignkey')
    op.drop_index('idx_expenses_source_status', table_name='expenses')
    op.drop_index('idx_expenses_reconciliation_status', table_name='expenses')
    op.drop_column('expenses', 'reconciliation_reviewed_at')
    op.drop_column('expenses', 'reconciliation_note')
    op.drop_column('expenses', 'duplicate_bank_transaction_id')
    op.drop_column('expenses', 'reconciliation_status')
