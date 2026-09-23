export type ProjectImageUpload = {
  id: string;
  url: string;
  file_path: string;
  file_name: string;
  is_main: boolean;
  display_order: number;
};

async function responseError(response: Response) {
  return (await response.text().catch(() => "")) || "Não foi possível processar a imagem.";
}

export async function uploadProjectImageFile(
  projectId: string,
  file: File,
): Promise<ProjectImageUpload> {
  const form = new FormData();
  form.set("projectId", projectId);
  form.set("file", file);
  const response = await fetch("/api/project-images/upload", {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json();
}

export async function uploadPendingProjectImages(
  projectId: string,
  images: Array<{ file?: File }>,
) {
  const uploaded: ProjectImageUpload[] = [];
  for (const image of images)
    if (image.file) uploaded.push(await uploadProjectImageFile(projectId, image.file));
  return uploaded;
}
