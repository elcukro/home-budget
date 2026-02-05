"""Add is_first_login to users

Revision ID: c3d4e5f6g7h8
Revises: b2c3d4e5f6g7
Create Date: 2026-02-05 22:00:00.000000

This migration adds:
- is_first_login: Boolean field on users table to track first-time login
  for automatic onboarding redirect. Existing users are backfilled
  with False so they are not affected.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6g7h8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6g7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_first_login column to users table with backfill."""
    # Add column as nullable first for backfill
    op.add_column(
        'users',
        sa.Column('is_first_login', sa.Boolean(), nullable=True,
                  comment='Tracks whether user has completed first login onboarding redirect')
    )

    # Backfill existing users with False (they should not see onboarding redirect)
    op.execute("UPDATE users SET is_first_login = false WHERE is_first_login IS NULL")

    # Make column non-nullable with server default for new rows
    op.alter_column('users', 'is_first_login',
                    nullable=False,
                    server_default=sa.text('true'))


def downgrade() -> None:
    """Remove is_first_login column from users table."""
    op.drop_column('users', 'is_first_login')
