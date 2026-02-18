"""Add AI chat tables

Revision ID: a65826cced41
Revises: bda16d35b9c0
Create Date: 2026-02-17 18:39:20.341551

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = 'a65826cced41'
down_revision: Union[str, Sequence[str], None] = 'bda16d35b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'ai_conversations' not in existing_tables:
        op.create_table('ai_conversations',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.String(), nullable=True),
            sa.Column('title', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('idx_ai_conversations_user_id', 'ai_conversations', ['user_id'], unique=False)

    if 'ai_messages' not in existing_tables:
        op.create_table('ai_messages',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('conversation_id', sa.Integer(), nullable=True),
            sa.Column('role', sa.String(), nullable=False),
            sa.Column('content', sa.String(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
            sa.ForeignKeyConstraint(['conversation_id'], ['ai_conversations.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('idx_ai_messages_conversation_id', 'ai_messages', ['conversation_id'], unique=False)

    if 'ai_usage_quotas' not in existing_tables:
        op.create_table('ai_usage_quotas',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.String(), nullable=True),
            sa.Column('month', sa.String(), nullable=True),
            sa.Column('queries_used', sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', 'month', name='uq_ai_quota_user_month'),
        )
        op.create_index('idx_ai_usage_quotas_user_id', 'ai_usage_quotas', ['user_id'], unique=False)
        op.create_index('idx_ai_usage_quotas_month', 'ai_usage_quotas', ['month'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('ai_messages')
    op.drop_table('ai_usage_quotas')
    op.drop_table('ai_conversations')
