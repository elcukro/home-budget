from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# Revision for adding onboarding-related features:
# 1. Add onboarding_completed fields to settings table
# 2. Create onboarding_backups table

def upgrade():
    # Add onboarding columns to settings table
    op.add_column('settings', sa.Column('onboarding_completed', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('settings', sa.Column('onboarding_completed_at', sa.DateTime(timezone=True), nullable=True))

    # Set default for existing rows
    op.execute("UPDATE settings SET onboarding_completed = false WHERE onboarding_completed IS NULL")

    # Create onboarding_backups table
    op.create_table(
        'onboarding_backups',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('reason', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Create indexes
    op.create_index('idx_onboarding_backups_user_id', 'onboarding_backups', ['user_id'])
    op.create_index('idx_onboarding_backups_created_at', 'onboarding_backups', ['created_at'])

def downgrade():
    # Drop indexes
    op.drop_index('idx_onboarding_backups_created_at', 'onboarding_backups')
    op.drop_index('idx_onboarding_backups_user_id', 'onboarding_backups')

    # Drop onboarding_backups table
    op.drop_table('onboarding_backups')

    # Remove onboarding columns from settings table
    op.drop_column('settings', 'onboarding_completed')
    op.drop_column('settings', 'onboarding_completed_at')
