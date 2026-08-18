# Plan: Add Property Area Fields

Add "Área do Terreno", "Área Construída", and "Área Total" fields to the project management modules.

## User Review Required

> [!IMPORTANT]
> The new fields will be added to the database as numeric values (m²). The existing "Área Privativa" field will remain as it is (currently a string) to ensure backward compatibility as requested.

## Proposed Changes

### Database
- Add `land_area` (numeric, 2 decimal places) to `public.projetos` table.
- Add `built_area` (numeric, 2 decimal places) to `public.projetos` table.
- Add `total_area` (numeric, 2 decimal places) to `public.projetos` table.

### Project Creation & Editing
- Update `src/routes/_authenticated/projetos.novo.tsx`:
    - Add UI fields for Land Area, Built Area, and Total Area in the "Imóvel" section.
    - Implement numeric masks and "m²" suffix.
    - Update `onSubmit` logic to persist these new fields to Supabase.

### Project View (Hub)
- Update `src/routes/projetos.$id.index.tsx`:
    - Display the new area fields in the "Visão Geral > Imóvel" block.
    - Format values with the "m²" suffix.

## Technical Details
- Using `numeric(15,2)` for the new database columns to support precise measurements.
- Layout will be adjusted to follow the requested 7-line structure in the project registration form.
- The `Input` components for these fields will use a pattern/mask to handle decimal separators and suffix.
