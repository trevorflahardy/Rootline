-- Add extended relationship types: sibling, step_parent, step_child, in_law, guardian
ALTER TABLE relationships
  DROP CONSTRAINT IF EXISTS relationships_relationship_type_check;

ALTER TABLE relationships
  ADD CONSTRAINT relationships_relationship_type_check
  CHECK (relationship_type IN (
    'parent_child',
    'spouse',
    'divorced',
    'adopted',
    'sibling',
    'step_parent',
    'step_child',
    'in_law',
    'guardian'
  ));
