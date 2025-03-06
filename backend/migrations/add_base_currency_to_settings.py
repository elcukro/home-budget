from alembic import op
import sqlalchemy as sa

# Revision for adding base_currency to settings table

def upgrade():
    # Add base_currency column to settings table
    op.add_column('settings', sa.Column('base_currency', sa.String(), nullable=True, server_default='USD'))
    
    # Update existing rows to have USD as the base_currency
    op.execute("UPDATE settings SET base_currency = 'USD' WHERE base_currency IS NULL")
    
    # Make column not nullable after setting defaults
    op.alter_column('settings', 'base_currency', nullable=False)

def downgrade():
    # Remove the column
    op.drop_column('settings', 'base_currency')