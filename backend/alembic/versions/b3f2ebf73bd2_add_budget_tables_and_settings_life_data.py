"""Add budget tables and settings life data

Revision ID: b3f2ebf73bd2
Revises: c3d4e5f6g7h8
Create Date: 2026-02-09 05:11:13.543578

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3f2ebf73bd2'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6g7h8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    """Check if a column already exists in a table."""
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = :table AND column_name = :column"
    ), {"table": table, "column": column})
    return result.fetchone() is not None


def _index_exists(index_name: str) -> bool:
    """Check if an index already exists."""
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname = :name"
    ), {"name": index_name})
    return result.fetchone() is not None


def upgrade() -> None:
    """Upgrade schema — idempotent (safe to re-run on partially migrated DBs)."""
    if not _column_exists('bank_transactions', 'duplicate_confidence'):
        op.add_column('bank_transactions', sa.Column('duplicate_confidence', sa.Float(), nullable=True))
    if not _column_exists('bank_transactions', 'duplicate_reason'):
        op.add_column('bank_transactions', sa.Column('duplicate_reason', sa.String(), nullable=True))
    if not _index_exists('idx_bank_transactions_is_duplicate'):
        op.create_index('idx_bank_transactions_is_duplicate', 'bank_transactions', ['is_duplicate'], unique=False)
    if not _index_exists('idx_bank_tx_duplicate_lookup'):
        op.create_index('idx_bank_tx_duplicate_lookup', 'bank_transactions', ['user_id', 'date', 'currency'], unique=False)
    if not _column_exists('settings', 'marital_status'):
        op.add_column('settings', sa.Column('marital_status', sa.String(), nullable=True))
    if not _column_exists('settings', 'housing_type'):
        op.add_column('settings', sa.Column('housing_type', sa.String(), nullable=True))
    if not _column_exists('settings', 'children_age_range'):
        op.add_column('settings', sa.Column('children_age_range', sa.String(), nullable=True))
    op.alter_column('users', 'is_first_login',
               existing_type=sa.BOOLEAN(),
               nullable=False,
               existing_server_default=sa.text('true'))


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('users', 'is_first_login',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.drop_column('settings', 'children_age_range')
    op.drop_column('settings', 'housing_type')
    op.drop_column('settings', 'marital_status')
    op.drop_index('idx_bank_tx_duplicate_lookup', table_name='bank_transactions')
    op.drop_index('idx_bank_transactions_is_duplicate', table_name='bank_transactions')
    op.drop_column('bank_transactions', 'duplicate_reason')
    op.drop_column('bank_transactions', 'duplicate_confidence')
