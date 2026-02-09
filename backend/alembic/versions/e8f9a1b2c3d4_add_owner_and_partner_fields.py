"""Add owner to income and partner tax profile to settings

Revision ID: e8f9a1b2c3d4
Revises: d7e8f9a0b1c2
Create Date: 2026-02-09 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8f9a1b2c3d4'
down_revision: Union[str, Sequence[str], None] = 'd7e8f9a0b1c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add owner field to income, partner tax profile fields to settings."""
    # Income: owner field
    op.add_column('income', sa.Column('owner', sa.String(), nullable=True))

    # Savings: owner field (for partner IKE/IKZE/OIPE)
    op.add_column('savings', sa.Column('owner', sa.String(), nullable=True))

    # Settings: partner tax profile fields
    op.add_column('settings', sa.Column('partner_name', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('partner_employment_status', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('partner_tax_form', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('partner_birth_year', sa.Integer(), nullable=True))
    op.add_column('settings', sa.Column('partner_use_authors_costs', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('settings', sa.Column('partner_ppk_enrolled', sa.Boolean(), nullable=True))
    op.add_column('settings', sa.Column('partner_ppk_employee_rate', sa.Float(), nullable=True))
    op.add_column('settings', sa.Column('partner_ppk_employer_rate', sa.Float(), nullable=True))


def downgrade() -> None:
    """Remove owner and partner fields."""
    op.drop_column('income', 'owner')
    op.drop_column('savings', 'owner')
    op.drop_column('settings', 'partner_name')
    op.drop_column('settings', 'partner_employment_status')
    op.drop_column('settings', 'partner_tax_form')
    op.drop_column('settings', 'partner_birth_year')
    op.drop_column('settings', 'partner_use_authors_costs')
    op.drop_column('settings', 'partner_ppk_enrolled')
    op.drop_column('settings', 'partner_ppk_employee_rate')
    op.drop_column('settings', 'partner_ppk_employer_rate')
