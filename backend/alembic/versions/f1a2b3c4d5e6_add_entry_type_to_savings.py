"""add entry_type to savings

Revision ID: f1a2b3c4d5e6
Revises: 50d5d2ac8e50
Create Date: 2026-02-12 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = '50d5d2ac8e50'
branch_labels = None
depends_on = None


def upgrade():
    # Add entry_type column with default 'contribution'
    op.add_column('savings',
        sa.Column('entry_type', sa.String(), nullable=True, server_default='contribution')
    )

    # Migrate existing PPK corrections to opening_balance type
    # These are manual balance entries that should not count toward limits
    op.execute("""
        UPDATE savings
        SET entry_type = 'opening_balance'
        WHERE account_type = 'ppk'
        AND description LIKE '%Korekta stanu PPK%'
    """)

    # Make column non-nullable after setting defaults
    op.alter_column('savings', 'entry_type', nullable=False)

    # Add index for performance on entry_type queries
    op.create_index('idx_savings_entry_type', 'savings', ['entry_type'])


def downgrade():
    # Drop index first
    op.drop_index('idx_savings_entry_type', table_name='savings')

    # Drop column
    op.drop_column('savings', 'entry_type')
