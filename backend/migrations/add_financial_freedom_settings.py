from alembic import op
import sqlalchemy as sa

# Revision for adding financial freedom settings to user settings

def upgrade():
    # Add emergency_fund_target and emergency_fund_months columns to settings table
    op.add_column('settings', sa.Column('emergency_fund_target', sa.Integer(), nullable=True, server_default='1000'))
    op.add_column('settings', sa.Column('emergency_fund_months', sa.Integer(), nullable=True, server_default='3'))
    
    # Update any existing rows to have the default values
    op.execute("UPDATE settings SET emergency_fund_target = 1000 WHERE emergency_fund_target IS NULL")
    op.execute("UPDATE settings SET emergency_fund_months = 3 WHERE emergency_fund_months IS NULL")

    # Make columns not nullable after setting defaults
    op.alter_column('settings', 'emergency_fund_target', nullable=False)
    op.alter_column('settings', 'emergency_fund_months', nullable=False)

def downgrade():
    # Remove the columns
    op.drop_column('settings', 'emergency_fund_target')
    op.drop_column('settings', 'emergency_fund_months')