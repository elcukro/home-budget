from alembic import op
import sqlalchemy as sa

# Revision for adding Polish tax-specific settings

def upgrade():
    # Add Polish tax-specific columns to settings table
    op.add_column('settings', sa.Column('employment_status', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('tax_form', sa.String(), nullable=True))
    op.add_column('settings', sa.Column('birth_year', sa.Integer(), nullable=True))
    op.add_column('settings', sa.Column('use_authors_costs', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('settings', sa.Column('ppk_enrolled', sa.Boolean(), nullable=True))
    op.add_column('settings', sa.Column('ppk_employee_rate', sa.Float(), nullable=True))
    op.add_column('settings', sa.Column('ppk_employer_rate', sa.Float(), nullable=True))
    op.add_column('settings', sa.Column('children_count', sa.Integer(), nullable=True, server_default='0'))

    # Set default for use_authors_costs and children_count
    op.execute("UPDATE settings SET use_authors_costs = false WHERE use_authors_costs IS NULL")
    op.execute("UPDATE settings SET children_count = 0 WHERE children_count IS NULL")

def downgrade():
    # Remove the columns
    op.drop_column('settings', 'employment_status')
    op.drop_column('settings', 'tax_form')
    op.drop_column('settings', 'birth_year')
    op.drop_column('settings', 'use_authors_costs')
    op.drop_column('settings', 'ppk_enrolled')
    op.drop_column('settings', 'ppk_employee_rate')
    op.drop_column('settings', 'ppk_employer_rate')
    op.drop_column('settings', 'children_count')
