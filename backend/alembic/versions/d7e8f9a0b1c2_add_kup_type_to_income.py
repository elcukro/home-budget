"""Add kup_type to income

Revision ID: d7e8f9a0b1c2
Revises: fb6043325432
Create Date: 2026-02-09 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd7e8f9a0b1c2'
down_revision: Union[str, Sequence[str], None] = 'fb6043325432'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add kup_type column to income table."""
    op.add_column('income', sa.Column('kup_type', sa.String(), nullable=True))


def downgrade() -> None:
    """Remove kup_type column from income table."""
    op.drop_column('income', 'kup_type')
