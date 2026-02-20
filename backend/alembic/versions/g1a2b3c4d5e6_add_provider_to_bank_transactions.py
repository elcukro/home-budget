"""Add provider column to bank_transactions and last_sync_at to banking_connections

Revision ID: g1a2b3c4d5e6
Revises: a65826cced41
Create Date: 2026-02-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g1a2b3c4d5e6'
down_revision: str = 'a65826cced41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add provider column to bank_transactions with default "tink"
    op.add_column('bank_transactions', sa.Column('provider', sa.String(), server_default='tink', nullable=True))

    # Add last_sync_at to banking_connections
    op.add_column('banking_connections', sa.Column('last_sync_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('banking_connections', 'last_sync_at')
    op.drop_column('bank_transactions', 'provider')
