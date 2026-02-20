"""Add enable_banking_connections table

Revision ID: h2b3c4d5e6f7
Revises: g1a2b3c4d5e6
Create Date: 2026-02-20 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h2b3c4d5e6f7'
down_revision: str = 'g1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'enable_banking_connections',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('session_id', sa.String(), nullable=False),
        sa.Column('aspsp_name', sa.String(), nullable=False),
        sa.Column('aspsp_country', sa.String(), nullable=False),
        sa.Column('valid_until', sa.DateTime(timezone=True), nullable=False),
        sa.Column('accounts', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('last_sync_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_eb_connections_user_id', 'enable_banking_connections', ['user_id'])
    op.create_index('idx_eb_connections_session_id', 'enable_banking_connections', ['session_id'])
    op.create_index(op.f('ix_enable_banking_connections_id'), 'enable_banking_connections', ['id'])
    # Unique constraint on session_id
    op.create_unique_constraint('uq_eb_session_id', 'enable_banking_connections', ['session_id'])


def downgrade() -> None:
    op.drop_constraint('uq_eb_session_id', 'enable_banking_connections', type_='unique')
    op.drop_index(op.f('ix_enable_banking_connections_id'), table_name='enable_banking_connections')
    op.drop_index('idx_eb_connections_session_id', table_name='enable_banking_connections')
    op.drop_index('idx_eb_connections_user_id', table_name='enable_banking_connections')
    op.drop_table('enable_banking_connections')
