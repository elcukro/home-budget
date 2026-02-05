"""Add tink_audit_logs table

Revision ID: a1b2c3d4e5f6
Revises: c048544c5761
Create Date: 2026-02-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'c048544c5761'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create tink_audit_logs table with all indexes."""
    op.create_table(
        'tink_audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('tink_connection_id', sa.Integer(), nullable=True),
        sa.Column('action_type', sa.String(50), nullable=False),
        sa.Column('result', sa.String(20), nullable=False),
        sa.Column('request_method', sa.String(10), nullable=True),
        sa.Column('request_path', sa.String(200), nullable=True),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['tink_connection_id'], ['tink_connections.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for efficient querying
    op.create_index('ix_tink_audit_logs_id', 'tink_audit_logs', ['id'], unique=False)
    op.create_index('idx_tink_audit_logs_user_id', 'tink_audit_logs', ['user_id'], unique=False)
    op.create_index('idx_tink_audit_logs_action_type', 'tink_audit_logs', ['action_type'], unique=False)
    op.create_index('idx_tink_audit_logs_connection_id', 'tink_audit_logs', ['tink_connection_id'], unique=False)
    op.create_index('idx_tink_audit_logs_created_at', 'tink_audit_logs', ['created_at'], unique=False)
    # Composite index for common queries (user + date range)
    op.create_index('idx_tink_audit_logs_user_date', 'tink_audit_logs', ['user_id', 'created_at'], unique=False)


def downgrade() -> None:
    """Drop tink_audit_logs table and indexes."""
    op.drop_index('idx_tink_audit_logs_user_date', table_name='tink_audit_logs')
    op.drop_index('idx_tink_audit_logs_created_at', table_name='tink_audit_logs')
    op.drop_index('idx_tink_audit_logs_connection_id', table_name='tink_audit_logs')
    op.drop_index('idx_tink_audit_logs_action_type', table_name='tink_audit_logs')
    op.drop_index('idx_tink_audit_logs_user_id', table_name='tink_audit_logs')
    op.drop_index('ix_tink_audit_logs_id', table_name='tink_audit_logs')
    op.drop_table('tink_audit_logs')
