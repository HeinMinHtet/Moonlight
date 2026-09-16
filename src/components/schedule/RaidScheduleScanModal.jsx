import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  FileImage,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";
import { NativeSelect } from "@/components/ui/native-select.jsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.jsx";
import { Card } from "@/components/ui/card.jsx";
import { Badge } from "@/components/ui/badge.jsx";

const DEFAULT_RAID_OPTIONS = ["Venomous Abyss", "Tidebound Grotto"];
const DIFFICULTY_OPTIONS = ["Normal", "Heroic", "Mythic"];
const LOOT_OPTIONS = ["Unsaved", "Saved"];

/**
 * Client-side canvas compression/downscaling helper.
 * If image dimension exceeds maxDimension, resizes before uploading.
 */
export async function processAndDownscaleImage(fileOrBlob, maxDimension = 1920) {
  return new Promise((resolve, reject) => {
    if (!fileOrBlob) return reject(new Error("No file provided."));

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.onload = () => {
      const dataResult = reader.result;
      const isJsdom = typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.includes("jsdom");
      if (typeof window === "undefined" || typeof Image === "undefined" || isJsdom) {
        return resolve({ dataUrl: dataResult, mimeType: fileOrBlob.type || "image/jpeg" });
      }

      const img = new Image();
      img.onerror = () => {
        // If image object fails in test runner, fall back to raw dataUrl
        resolve({ dataUrl: dataResult, mimeType: fileOrBlob.type || "image/jpeg" });
      };
      img.onload = () => {
        let { width, height } = img;
        if (!width || !height) {
          return resolve({ dataUrl: dataResult, mimeType: fileOrBlob.type || "image/jpeg" });
        }

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return resolve({ dataUrl: dataResult, mimeType: fileOrBlob.type || "image/jpeg" });
          }
          ctx.drawImage(img, 0, 0, width, height);

          const outputMime = fileOrBlob.type === "image/png" ? "image/png" : "image/jpeg";
          const compressed = canvas.toDataURL(outputMime, 0.85);
          resolve({ dataUrl: compressed, mimeType: outputMime });
        } catch {
          resolve({ dataUrl: dataResult, mimeType: fileOrBlob.type || "image/jpeg" });
        }
      };
      img.src = dataResult;
    };
    reader.readAsDataURL(fileOrBlob);
  });
}

export function RaidScheduleScanModal({
  isOpen,
  weekAnchorDate,
  onClose,
  onScanImage,
  onBatchInsert
}) {
  const [selectedWeekAnchor, setSelectedWeekAnchor] = useState(weekAnchorDate || "");
  const [imagePreview, setImagePreview] = useState(null);
  const [imageData, setImageData] = useState(null);
  const [imageMime, setImageMime] = useState("image/jpeg");
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [extractedRuns, setExtractedRuns] = useState([]);
  const fileInputRef = useRef(null);

  // Sync initial week anchor
  useEffect(() => {
    if (weekAnchorDate) {
      setSelectedWeekAnchor(weekAnchorDate);
    }
  }, [weekAnchorDate]);

  // Reset state on open/close
  useEffect(() => {
    if (!isOpen) {
      setImagePreview(null);
      setImageData(null);
      setFileName("");
      setScanError(null);
      setExtractedRuns([]);
      setIsScanning(false);
      setIsImporting(false);
    }
  }, [isOpen]);

  // Process incoming image file
  const handleFileProcess = useCallback(async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setScanError("Please select a valid image file (PNG, JPEG, WEBP).");
      return;
    }

    setScanError(null);
    setFileName(file.name || "Pasted screenshot");

    try {
      const { dataUrl, mimeType } = await processAndDownscaleImage(file);
      setImagePreview(dataUrl);
      setImageData(dataUrl);
      setImageMime(mimeType);
    } catch (err) {
      setScanError(`Failed to process image: ${err.message}`);
    }
  }, []);

  // Global paste handler for screenshot convenience
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleFileProcess(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, handleFileProcess]);

  // Drag & drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileProcess(files[0]);
    }
  };

  // Perform AI scan
  const handleScan = async () => {
    if (!imageData) {
      setScanError("Please select or paste an image first.");
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      const result = await onScanImage({
        image: imageData,
        mimeType: imageMime,
        weekAnchorDate: selectedWeekAnchor
      });

      if (result && Array.isArray(result.runs)) {
        if (result.runs.length === 0) {
          setScanError("No raid runs could be identified from this image. You can manually add runs below.");
        }
        setExtractedRuns(result.runs);
      } else {
        setScanError("Could not extract schedule runs from the image.");
      }
    } catch (err) {
      setScanError(err.message || "Scanning failed.");
    } finally {
      setIsScanning(false);
    }
  };

  // Update a field in a run
  const updateRun = (index, field, value) => {
    setExtractedRuns((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Delete a run
  const deleteRun = (index) => {
    setExtractedRuns((prev) => prev.filter((_, i) => i !== index));
  };

  // Add empty run
  const addRun = () => {
    setExtractedRuns((prev) => [
      ...prev,
      {
        date: selectedWeekAnchor || new Date().toISOString().slice(0, 10),
        timeEst: "20:00",
        raid: "Venomous Abyss",
        difficulty: "Heroic",
        loot: "Unsaved",
        maxBuyers: 6,
        lead: "",
        note: ""
      }
    ]);
  };

  // Batch import runs
  const handleImport = async () => {
    if (!extractedRuns.length) return;

    // Validate that runs have date and raid
    const invalidRun = extractedRuns.find((r) => !r.date || !r.raid);
    if (invalidRun) {
      setScanError("Every run must have a valid date and raid instance name.");
      return;
    }

    setIsImporting(true);
    setScanError(null);

    try {
      await onBatchInsert(extractedRuns);
      onClose();
    } catch (err) {
      setScanError(err.message || "Failed to import raid runs.");
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  const isGeminiKeyMissing =
    scanError &&
    (scanError.includes("GEMINI_API_KEY") ||
      scanError.includes("Gemini API key is not configured") ||
      scanError.includes("503"));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan Raid Schedule Photo"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-4xl max-h-[92vh] flex flex-col border-border bg-card shadow-2xl overflow-hidden rounded-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Camera className="size-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                Scan Raid Schedule Photo
                <Badge variant="secondary" className="text-[11px] font-mono gap-1">
                  <Sparkles className="size-3 text-amber-400" />
                  Gemini AI
                </Badge>
              </h2>
              <p className="text-xs text-muted-foreground">
                Upload or paste a schedule screenshot to automatically extract and populate raid runs.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Week Anchor Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/10 items-center">
            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Lockout Week Reset Date (Tuesday)
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Relative days (e.g. "Tuesday", "Wed", "Fri") in the photo anchor to this Tuesday lockout cycle.
              </p>
            </div>
            <div>
              <Input
                type="date"
                value={selectedWeekAnchor}
                onChange={(e) => setSelectedWeekAnchor(e.target.value)}
                className="text-xs"
                aria-label="Lockout Week Reset Date"
              />
            </div>
          </div>

          {/* Dropzone & Preview */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !imagePreview && fileInputRef.current?.click()}
            className={`relative rounded-xl border-2 border-dashed p-6 transition-colors text-center ${
              isDragging
                ? "border-primary bg-primary/5"
                : imagePreview
                ? "border-border/60 bg-muted/5"
                : "border-border hover:border-primary/60 bg-muted/5 cursor-pointer"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileProcess(file);
              }}
            />

            {imagePreview ? (
              <div className="flex flex-col sm:flex-row items-center gap-4 text-left">
                <img
                  src={imagePreview}
                  alt="Schedule Preview"
                  className="max-h-40 max-w-full sm:max-w-xs object-contain rounded-lg border border-border shadow-sm bg-black/40"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <FileImage className="size-4 text-primary" />
                    <span className="text-xs font-medium text-foreground truncate max-w-[240px]">
                      {fileName}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Image ready for analysis. Click "Scan Schedule with AI" to parse runs.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="text-xs h-7"
                    >
                      Change Photo
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImagePreview(null);
                        setImageData(null);
                        setFileName("");
                      }}
                      className="text-xs h-7 text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-2 py-4">
                <div className="p-3 rounded-full bg-primary/10 text-primary">
                  <UploadCloud className="size-8" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Click to browse, drag & drop, or paste screenshot (Ctrl+V)
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Supports PNG, JPEG, or WEBP images up to 10MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action to trigger scan */}
          {imageData && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleScan}
                disabled={isScanning}
                className="gap-2 font-semibold shadow-sm"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Analyzing schedule photo with Gemini...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4 text-amber-300" />
                    <span>Scan Schedule with AI</span>
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Error Banner */}
          {scanError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>
                {isGeminiKeyMissing ? "Gemini API Key Required" : "Scan Error"}
              </AlertTitle>
              <AlertDescription className="text-xs mt-1">
                {isGeminiKeyMissing ? (
                  <>
                    Google Gemini API key is not configured on the server. Please add{" "}
                    <code className="bg-destructive/20 px-1 py-0.5 rounded font-mono text-[11px]">
                      GEMINI_API_KEY=your_key_here
                    </code>{" "}
                    to the server <code className="font-mono">.env</code> file.
                  </>
                ) : (
                  scanError
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Extracted Runs Review Table */}
          {extractedRuns.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-foreground">
                    Draft Runs for Review ({extractedRuns.length})
                  </h3>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                    <CheckCircle2 className="size-3 mr-1" />
                    Review & Edit
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRun}
                  className="text-xs h-7 gap-1"
                >
                  <Plus className="size-3" />
                  Add Run
                </Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground">
                      <th className="p-2.5 font-semibold w-32">Date</th>
                      <th className="p-2.5 font-semibold w-24">Time EST</th>
                      <th className="p-2.5 font-semibold w-40">Raid Instance</th>
                      <th className="p-2.5 font-semibold w-28">Difficulty</th>
                      <th className="p-2.5 font-semibold w-28">Loot</th>
                      <th className="p-2.5 font-semibold w-20">8/8 Cap</th>
                      <th className="p-2.5 font-semibold w-32">Lead</th>
                      <th className="p-2.5 font-semibold">Note</th>
                      <th className="p-2.5 font-semibold w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {extractedRuns.map((run, idx) => (
                      <tr key={idx} className="hover:bg-muted/10 transition-colors">
                        <td className="p-2">
                          <Input
                            type="date"
                            value={run.date || ""}
                            onChange={(e) => updateRun(idx, "date", e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="text"
                            value={run.timeEst || ""}
                            placeholder="20:00"
                            onChange={(e) => updateRun(idx, "timeEst", e.target.value)}
                            className="h-8 text-xs font-mono"
                          />
                        </td>
                        <td className="p-2">
                          <NativeSelect
                            value={run.raid || "Venomous Abyss"}
                            onChange={(e) => updateRun(idx, "raid", e.target.value)}
                            className="h-8 min-h-8 text-xs py-0"
                          >
                            {DEFAULT_RAID_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                            {!DEFAULT_RAID_OPTIONS.includes(run.raid) && run.raid && (
                              <option value={run.raid}>{run.raid}</option>
                            )}
                          </NativeSelect>
                        </td>
                        <td className="p-2">
                          <NativeSelect
                            value={run.difficulty || "Heroic"}
                            onChange={(e) => updateRun(idx, "difficulty", e.target.value)}
                            className="h-8 min-h-8 text-xs py-0"
                          >
                            {DIFFICULTY_OPTIONS.map((diff) => (
                              <option key={diff} value={diff}>
                                {diff}
                              </option>
                            ))}
                          </NativeSelect>
                        </td>
                        <td className="p-2">
                          <NativeSelect
                            value={run.loot || "Unsaved"}
                            onChange={(e) => updateRun(idx, "loot", e.target.value)}
                            className="h-8 min-h-8 text-xs py-0"
                          >
                            {LOOT_OPTIONS.map((lt) => (
                              <option key={lt} value={lt}>
                                {lt}
                              </option>
                            ))}
                          </NativeSelect>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="1"
                            max="30"
                            value={run.maxBuyers ?? 6}
                            onChange={(e) => updateRun(idx, "maxBuyers", parseInt(e.target.value, 10) || 6)}
                            className="h-8 text-xs font-mono text-center"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="text"
                            placeholder="Leader"
                            value={run.lead || ""}
                            onChange={(e) => updateRun(idx, "lead", e.target.value)}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="text"
                            placeholder="Armor stack / notes"
                            value={run.note || ""}
                            onChange={(e) => updateRun(idx, "note", e.target.value)}
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteRun(idx)}
                            className="size-7 text-muted-foreground hover:text-destructive"
                            title="Delete run"
                            aria-label="Delete run"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border/80 px-6 py-4 bg-muted/20">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isImporting}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleImport}
            disabled={extractedRuns.length === 0 || isImporting || isScanning}
            className="gap-2 font-semibold"
          >
            {isImporting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Importing runs...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span>Import All Runs ({extractedRuns.length})</span>
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
