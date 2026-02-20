"""Add is_internal_transfer to bank_transactions

Revision ID: i3c4d5e6f7g8
Revises: h2b3c4d5e6f7
Create Date: 2026-02-20 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i3c4d5e6f7g8'
down_revision: str = 'h2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bank_transactions', sa.Column('is_internal_transfer', sa.Boolean(), nullable=True, server_default=sa.text('false')))
    op.create_index('idx_bank_transactions_is_internal_transfer', 'bank_transactions', ['is_internal_transfer'])


def downgrade() -> None:
    op.drop_index('idx_bank_transactions_is_internal_transfer', table_name='bank_transactions')
    op.drop_column('bank_transactions', 'is_internal_transfer')
