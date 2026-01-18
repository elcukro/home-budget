from alembic import op
import sqlalchemy as sa

# Revision for adding data_export_backups table
# Stores user data exports for later retrieval

def upgrade():
    # Create data_export_backups table
    op.create_table(
        'data_export_backups',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('data', sa.JSON(), nullable=False),
        sa.Column('format', sa.String(), nullable=False, server_default='json'),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Create indexes
    op.create_index('idx_data_export_backups_user_id', 'data_export_backups', ['user_id'])
    op.create_index('idx_data_export_backups_created_at', 'data_export_backups', ['created_at'])


def downgrade():
    # Drop indexes
    op.drop_index('idx_data_export_backups_created_at', 'data_export_backups')
    op.drop_index('idx_data_export_backups_user_id', 'data_export_backups')

    # Drop table
    op.drop_table('data_export_backups')
