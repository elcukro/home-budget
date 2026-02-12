"""Add partner access tables

Revision ID: aab6ace2e994
Revises: f1a2b3c4d5e6
Create Date: 2026-02-12 08:48:05.065148

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aab6ace2e994'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add partner_links and partner_invitations tables."""
    op.create_table('partner_links',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('primary_user_id', sa.String(), nullable=False),
        sa.Column('partner_user_id', sa.String(), nullable=False),
        sa.Column('role', sa.String(), server_default='partner', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['primary_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['partner_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('partner_user_id', name='uq_partner_link'),
    )
    op.create_index('idx_partner_links_primary_user_id', 'partner_links', ['primary_user_id'])
    op.create_index('idx_partner_links_partner_user_id', 'partner_links', ['partner_user_id'])

    op.create_table('partner_invitations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('inviter_user_id', sa.String(), nullable=False),
        sa.Column('token', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['inviter_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token'),
    )
    op.create_index('idx_partner_invitations_token', 'partner_invitations', ['token'])
    op.create_index('idx_partner_invitations_inviter', 'partner_invitations', ['inviter_user_id'])


def downgrade() -> None:
    """Remove partner access tables."""
    op.drop_index('idx_partner_invitations_inviter', table_name='partner_invitations')
    op.drop_index('idx_partner_invitations_token', table_name='partner_invitations')
    op.drop_table('partner_invitations')

    op.drop_index('idx_partner_links_partner_user_id', table_name='partner_links')
    op.drop_index('idx_partner_links_primary_user_id', table_name='partner_links')
    op.drop_table('partner_links')
