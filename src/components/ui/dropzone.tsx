import ReactDropzone, { DropzoneOptions } from "react-dropzone";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import { ImageDown } from "lucide-react";

interface DropzoneProps extends DropzoneOptions {
  className?: string;
  disabled?: boolean;
}

const ACCEPTED_FILES = {
  "image/*": [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
    ".ico",
    ".tif",
    ".tiff",
  ],
};

export function Dropzone({ className, disabled, ...props }: DropzoneProps) {
  return (
    <ReactDropzone
      accept={ACCEPTED_FILES}
      disabled={disabled}
      {...props}>
      {({ getRootProps, getInputProps, isDragActive }) => (
        <div
          {...getRootProps()}
          className={cn(
            "bg-muted/50 rounded-md border-2 border-dashed flex flex-col items-center justify-center p-4 transition-colors",
            disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-accent hover:border-primary",
            isDragActive && "border-primary bg-accent/50",
            className
          )}>
          <Input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
            <ImageDown className="size-8 opacity-70" />
          </div>
        </div>
      )}
    </ReactDropzone>
  );
}
