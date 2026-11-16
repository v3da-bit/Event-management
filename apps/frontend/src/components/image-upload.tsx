"use client";
import { useState } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
export function ImageUpload({
  value,
  onChange,
}: {
  value?: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="image-upload">
      {value && (
        <div className="upload-preview">
          <img src={value} alt="Uploaded preview" />
          <button
            type="button"
            aria-label="Remove image"
            onClick={() => onChange("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <label className="upload-label">
        <Upload size={20} />
        <span>
          {busy ? "Uploading…" : "Choose an image"}
          <small>JPEG, PNG or WebP · up to 5 MB</small>
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
              toast.error("Choose an image smaller than 5 MB");
              return;
            }
            setBusy(true);
            const data = new FormData();
            data.append("file", file);
            try {
              const result = await api<{ url: string }>("/uploads/image", {
                method: "POST",
                body: data,
              });
              onChange(result.url);
              toast.success("Image uploaded");
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
    </div>
  );
}
