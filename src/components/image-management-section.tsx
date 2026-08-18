import React, { useState, useCallback, useEffect } from "react";
import { 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Image as ImageIcon,
  Upload,
  MoreVertical,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";

export interface ProjetoFoto {
  id: string;
  url: string;
  file_path: string;
  file_name: string;
  is_main: boolean;
  display_order: number;
  uploading?: boolean;
  progress?: number;
}

interface ImageManagementSectionProps {
  projetoId?: string;
  onImagesChange: (images: ProjetoFoto[]) => void;
  initialImages?: ProjetoFoto[];
}

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function ImageManagementSection({ 
  projetoId, 
  onImagesChange,
  initialImages = []
}: ImageManagementSectionProps) {
  const [images, setImages] = useState<ProjetoFoto[]>(initialImages);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    onImagesChange(images);
    if (images.length > 0 && selectedIndex >= images.length) {
      setSelectedIndex(images.length - 1);
    }
  }, [images, onImagesChange, selectedIndex]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files) return;

    const filesArray = Array.from(files);
    
    if (images.length + filesArray.length > MAX_IMAGES) {
      toast.error(`Você pode enviar no máximo ${MAX_IMAGES} imagens por projeto.`);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    for (const file of filesArray) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`Formato de arquivo não suportado: ${file.name}`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Arquivo muito grande: ${file.name} (Máx. 3MB)`);
        continue;
      }

      const tempId = Math.random().toString(36).substring(7);
      const tempUrl = URL.createObjectURL(file);
      
      const newPhoto: ProjetoFoto = {
        id: tempId,
        url: tempUrl,
        file_path: "",
        file_name: file.name,
        is_main: images.length === 0,
        display_order: images.length,
        uploading: true,
        progress: 0,
      };

      setImages(prev => [...prev, newPhoto]);

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${userId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('projeto_fotos')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('projeto_fotos')
          .getPublicUrl(filePath);

        setImages(prev => prev.map(img => 
          img.id === tempId 
            ? { ...img, url: publicUrl, file_path: filePath, uploading: false } 
            : img
        ));
        
        toast.success(`${file.name} enviado com sucesso.`);
      } catch (error: any) {
        console.error("Upload error:", error);
        toast.error(`Erro ao enviar ${file.name}: ${error.message}`);
        setImages(prev => prev.filter(img => img.id !== tempId));
      }
    }
  }, [images]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        const newArray = arrayMove(items, oldIndex, newIndex);
        
        // Update order and is_main (first one is main)
        return newArray.map((item, index) => ({
          ...item,
          display_order: index,
          is_main: index === 0
        }));
      });
    }
  };

  const setMainImage = (id: string) => {
    setImages(prev => {
      const targetIndex = prev.findIndex(img => img.id === id);
      if (targetIndex === -1) return prev;
      
      const newArray = arrayMove(prev, targetIndex, 0);
      return newArray.map((img, index) => ({
        ...img,
        display_order: index,
        is_main: index === 0
      }));
    });
    setSelectedIndex(0);
    toast.success("Imagem principal alterada.");
  };

  const deleteImage = async (id: string) => {
    const imgToDelete = images.find(img => img.id === id);
    if (!imgToDelete) return;

    try {
      if (imgToDelete.file_path) {
        await supabase.storage.from('projeto_fotos').remove([imgToDelete.file_path]);
      }
      
      const newImages = images.filter(img => img.id !== id);
      const updatedImages = newImages.map((img, index) => ({
        ...img,
        display_order: index,
        is_main: index === 0
      }));
      
      setImages(updatedImages);
      setIsDeleting(null);
      toast.success("Imagem excluída.");
    } catch (error: any) {
      toast.error(`Erro ao excluir imagem: ${error.message}`);
    }
  };

  const mainImage = images.length > 0 ? images[selectedIndex] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Fotos do imóvel</Label>
        <div className="flex items-center gap-2">
          {images.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {images.length} / {MAX_IMAGES} fotos
            </span>
          )}
          <input
            type="file"
            id="image-upload"
            className="hidden"
            multiple
            accept="image/*"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => document.getElementById("image-upload")?.click()}
            disabled={images.length >= MAX_IMAGES}
          >
            <Plus className="mr-2 h-4 w-4" /> Adicionar fotos
          </Button>
        </div>
      </div>

      {images.length === 0 ? (
        <div 
          className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl aspect-[16/7] bg-muted/30 transition-colors hover:bg-muted/50 cursor-pointer"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleUpload(e.dataTransfer.files);
          }}
          onClick={() => document.getElementById("image-upload")?.click()}
        >
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Upload className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Nenhuma imagem cadastrada para este imóvel.</p>
          <p className="text-xs text-muted-foreground mt-1">Clique ou arraste imagens aqui para iniciar o envio.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Main Preview */}
          <div className="relative group aspect-[16/7] w-full rounded-xl overflow-hidden bg-muted border">
            {mainImage?.uploading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                <Loader2 className="h-8 w-8 animate-spin text-brand mb-2" />
                <span className="text-xs font-medium">Enviando...</span>
              </div>
            ) : null}
            
            <img 
              src={mainImage?.url} 
              alt={mainImage?.file_name}
              className="w-full h-full object-cover"
            />

            {images.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full shadow-lg"
                  onClick={() => setSelectedIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity rounded-full shadow-lg"
                  onClick={() => setSelectedIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </>
            )}

            <div className="absolute top-4 left-4 flex gap-2">
              {mainImage?.is_main && (
                <div className="bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 uppercase">
                  <CheckCircle2 className="size-3" /> Principal
                </div>
              )}
            </div>
          </div>

          {/* Thumbnails list with Drag and Drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={images.map(img => img.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {images.map((img, index) => (
                  <SortableItem 
                    key={img.id} 
                    image={img} 
                    isSelected={selectedIndex === index}
                    onClick={() => setSelectedIndex(index)}
                    onDelete={() => setIsDeleting(img.id)}
                    onSetMain={() => setMainImage(img.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={!!isDeleting} onOpenChange={() => setIsDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir imagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente excluir esta imagem? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => isDeleting && deleteImage(isDeleting)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface SortableItemProps {
  image: ProjetoFoto;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
  onSetMain: () => void;
}

function SortableItem({ image, isSelected, onClick, onDelete, onSetMain }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group size-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
        isSelected ? "border-brand ring-2 ring-brand/20" : "border-transparent hover:border-border"
      } ${isDragging ? "opacity-50 cursor-grabbing" : "cursor-pointer"}`}
      onClick={onClick}
    >
      <img src={image.url} alt="" className="size-full object-cover" />
      
      {/* Drag Handle Overlay (Visible on Hover) */}
      <div 
        {...attributes} 
        {...listeners}
        className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <ImageIcon className="text-white size-5" />
      </div>

      {/* Main Indicator */}
      {image.is_main && (
        <div className="absolute top-1 left-1 bg-brand text-white rounded-full p-0.5 shadow-sm">
          <CheckCircle2 className="size-2.5" />
        </div>
      )}

      {/* Actions Dropdown */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="size-6 rounded-full shadow-sm">
              <MoreVertical className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {!image.is_main && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSetMain(); }}>
                <CheckCircle2 className="mr-2 size-4" /> Definir principal
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              className="text-destructive" 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="mr-2 size-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {image.uploading && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
        </div>
      )}
    </div>
  );
}
