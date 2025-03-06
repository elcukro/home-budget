"""
Migration script to add language column to insights_cache table
"""
from sqlalchemy import Column, String
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = 'add_language_to_insights_cache'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    """
    Add language column to insights_cache table
    """
    op.add_column('insights_cache', Column('language', String, server_default='en'))
    
    # Create an index on user_id, language, and is_stale for faster lookups
    op.create_index(
        'ix_insights_cache_user_id_language_is_stale',
        'insights_cache',
        ['user_id', 'language', 'is_stale']
    )

def downgrade():
    """
    Remove language column from insights_cache table
    """
    op.drop_index('ix_insights_cache_user_id_language_is_stale')
    op.drop_column('insights_cache', 'language') 