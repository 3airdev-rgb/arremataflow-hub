UPDATE organization_members
SET role = 'admin', updated_at = now()
WHERE role = 'owner';
