"""Add owner column to expenses

Revision ID: bda16d35b9c0
Revises: aab6ace2e994
Create Date: 2026-02-12 22:49:13.516160

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bda16d35b9c0'
down_revision: Union[str, Sequence[str], None] = 'aab6ace2e994'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('expenses', sa.Column('owner', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('expenses', 'owner')
