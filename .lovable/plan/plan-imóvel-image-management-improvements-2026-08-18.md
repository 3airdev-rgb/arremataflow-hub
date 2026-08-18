# Plan - Imóvel Image Management Improvements

Improve the property image management module in the project registration form to support user-uploaded images, drag-and-drop, and dynamic gallery features while persisting to Lovable Cloud storage.

## User-facing changes

- **Empty State**: New projects will start with no images, showing an informative message.
- **Image Upload**: Support for uploading up to 10 images (max 3MB each) via file picker or drag-and-drop.
- **Main Image**: The first uploaded image is automatically set as the "Main Image". Users can change the main image by reordering or via a menu option.
- **Gallery Features**:
  - Reorder images via drag-and-drop.
  - Delete images with a confirmation dialog.
  - Navigation controls (Previous/Next) on the large preview image.
- **Persistence**: Images will be uploaded to Lovable Cloud storage and their metadata (order, path, main flag) saved to the database.

## Technical details

- **Storage**: Use Lovable Cloud (Supabase) Storage bucket `projeto_fotos`.
- **Database**: Add `projeto_fotos` table to track image metadata (ID, projeto_id, path, order, is_main, etc.).
- **Components**:
  - Create `src/components/image-management-section.tsx` to handle the logic and UI.
  - Integrate `dnd-kit` or `react-beautiful-dnd` (or similar) for reordering if not already available. (Will check if I should use a lighter approach first).
  - Use `sonner` for progress bars and validation messages.
- **Validations**: File size (3MB), type (JPG, PNG, WEBP), and count (max 10).
- **Security**: Enable RLS on the new table and storage bucket.

## Implementation Steps

1. **Database Schema**: Create `projeto_fotos` table and `projeto_fotos` storage bucket via migration.
2. **Component Development**:
   - Create the image management UI with upload, preview, and controls.
   - Implement upload logic to Supabase Storage.
   - Implement drag-and-drop reordering.
3. **Integration**:
   - Replace the static gallery in `src/routes/_authenticated/projetos.novo.tsx` with the new component.
   - Update project creation logic to link uploaded images to the new project ID.
4. **Validation**: Verify upload limits, reordering, and deletion logic.
