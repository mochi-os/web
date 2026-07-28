// Mochi: Colour picker component with presets, graphical HSV picker, and hex input
// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

import { t } from '@lingui/core/macro'
import { useCallback, useEffect, useRef, useState } from "react";
import { Trans } from '@lingui/react/macro'
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export const PRESET_COLOURS = [
  "#ffffff",
  "#94a3b8",
  "#f87171",
  "#fb923c",
  "#fbbf24",
  "#4ade80",
  "#2dd4bf",
  "#22d3ee",
  "#60a5fa",
  "#a78bfa",
  "#f472b6",
  "#000000",
];

// Convert hex to HSV
function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

// Convert HSV to hex
function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Convert hue to CSS colour for the hue at full saturation/value
function hueToColour(h: number): string {
  return hsvToHex(h, 1, 1);
}

interface ColourPickerProps {
  value: string;
  onChange: (colour: string) => void;
  onClear?: () => void;
  actions?: React.ReactNode;
  className?: string;
  // When true, the gradient/hue/hex picker starts hidden behind a "Custom"
  // toggle and only the preset swatches are shown. Opt-in; existing callers
  // keep the fully-expanded layout.
  collapsible?: boolean;
}

export function ColourPicker({ value, onChange, onClear, actions, className, collapsible = false }: ColourPickerProps) {
  const hasValue = value !== "";
  const [hsv, setHsv] = useState<[number, number, number]>(() =>
    hasValue ? hexToHsv(value) : [0, 0, 1],
  );
  const svCanvasRef = useRef<HTMLCanvasElement>(null);
  const hueCanvasRef = useRef<HTMLCanvasElement>(null);
  const [draggingSV, setDraggingSV] = useState(false);
  const [draggingHue, setDraggingHue] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  // Advanced picker visibility. Always open when not collapsible. When
  // collapsible, open automatically if the current value isn't a preset.
  const isPresetValue = hasValue && PRESET_COLOURS.some((c) => c.toLowerCase() === value.toLowerCase());
  const [advancedOpen, setAdvancedOpen] = useState(!collapsible || (hasValue && !isPresetValue));

  // Sync internal state when value prop changes externally
  useEffect(() => {
    if (value === "") {
      setHexInput("");
      return;
    }
    const normalised = value.toLowerCase();
    if (normalised !== hsvToHex(hsv[0], hsv[1], hsv[2]).toLowerCase()) {
      setHsv(hexToHsv(value));
      setHexInput(value);
    }
  }, [value]);

  // Draw the saturation/value gradient
  const drawSV = useCallback(() => {
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    // White-to-hue horizontal gradient
    const hGrad = ctx.createLinearGradient(0, 0, w, 0);
    hGrad.addColorStop(0, "#ffffff");
    hGrad.addColorStop(1, hueToColour(hsv[0]));
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, w, h);

    // Transparent-to-black vertical gradient
    const vGrad = ctx.createLinearGradient(0, 0, 0, h);
    vGrad.addColorStop(0, "rgba(0,0,0,0)");
    vGrad.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, w, h);
  }, [hsv[0]]);

  // Draw the hue strip
  const drawHue = useCallback(() => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 6; i++) {
      grad.addColorStop(i / 6, hueToColour(i * 60));
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }, []);

  useEffect(() => { drawSV(); }, [drawSV]);
  useEffect(() => { drawHue(); }, [drawHue]);

  // Update colour from HSV and emit
  const updateFromHsv = useCallback((h: number, s: number, v: number) => {
    setHsv([h, s, v]);
    const hex = hsvToHex(h, s, v);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  // SV canvas interaction
  const handleSVInteraction = useCallback((clientX: number, clientY: number) => {
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    updateFromHsv(hsv[0], s, v);
  }, [hsv[0], updateFromHsv]);

  // Hue canvas interaction
  const handleHueInteraction = useCallback((clientX: number) => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const h = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360));
    updateFromHsv(h, hsv[1], hsv[2]);
  }, [hsv[1], hsv[2], updateFromHsv]);

  // Mouse event handlers
  useEffect(() => {
    if (!draggingSV && !draggingHue) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      if (draggingSV) handleSVInteraction(e.clientX, e.clientY);
      if (draggingHue) handleHueInteraction(e.clientX);
    };
    const handleMouseUp = () => {
      setDraggingSV(false);
      setDraggingHue(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingSV, draggingHue, handleSVInteraction, handleHueInteraction]);

  // Touch event handlers
  const handleTouchMove = useCallback((e: React.TouchEvent, type: "sv" | "hue") => {
    e.preventDefault();
    const touch = e.touches[0];
    if (type === "sv") handleSVInteraction(touch.clientX, touch.clientY);
    else handleHueInteraction(touch.clientX);
  }, [handleSVInteraction, handleHueInteraction]);

  // Hex input handler
  const handleHexChange = (val: string) => {
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      const newHsv = hexToHsv(val);
      setHsv(newHsv);
      onChange(val.toLowerCase());
    }
  };

  // Check if a preset is the selected colour
  const isSelected = (preset: string) => {
    if (!hasValue) return false;
    return preset.toLowerCase() === hsvToHex(hsv[0], hsv[1], hsv[2]).toLowerCase();
  };

  return (
    <div className={className}>
      {/* Preset swatches */}
      <div className="flex flex-wrap gap-2">
        {PRESET_COLOURS.map((c) => (
          <button
            key={c}
            type="button"
            className={`size-7 rounded-full border border-border ${
              isSelected(c) ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""
            }`}
            style={{ backgroundColor: c }}
            onClick={() => {
              const newHsv = hexToHsv(c);
              setHsv(newHsv);
              setHexInput(c);
              onChange(c);
            }}
          />
        ))}
      </div>

      {/* Compact controls: custom-colour toggle + actions (collapsible mode only) */}
      {collapsible && (
        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAdvancedOpen((o) => !o)}
          >
            {hasValue && (
              <span
                className="size-4 rounded-full border border-border"
                style={{ backgroundColor: hsvToHex(hsv[0], hsv[1], hsv[2]) }}
              />
            )}
            <Trans>Custom</Trans>
            <ChevronDown
              className={cn("size-3.5 transition-transform", advancedOpen && "rotate-180")}
            />
          </Button>
          {((onClear && hasValue) || actions) && (
            <div className="ms-auto flex items-center gap-2">
              {onClear && hasValue && (
                <Button type="button" variant="outline" size="sm" onClick={onClear}>
                  <Trans>Clear</Trans>
                </Button>
              )}
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Advanced picker — kept mounted (so the canvases stay drawn) but hidden when collapsed */}
      <div className={cn(collapsible && !advancedOpen && "hidden")}>
      {/* SV gradient box */}
      <canvas
        ref={svCanvasRef}
        width={280}
        height={160}
        className="w-full h-40 rounded-md cursor-crosshair mt-3 border border-border"
        onMouseDown={(e) => {
          setDraggingSV(true);
          handleSVInteraction(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          handleSVInteraction(e.touches[0].clientX, e.touches[0].clientY);
        }}
        onTouchMove={(e) => handleTouchMove(e, "sv")}
      />
      {/* SV indicator overlay */}
      <div className="relative -mt-40 h-40 pointer-events-none">
        {hasValue && (
          <div
            className="absolute size-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${hsv[1] * 100}%`,
              top: `${(1 - hsv[2]) * 100}%`,
            }}
          />
        )}
      </div>

      {/* Hue strip */}
      <canvas
        ref={hueCanvasRef}
        width={280}
        height={16}
        className="w-full h-4 rounded-full cursor-pointer mt-3 border border-border"
        onMouseDown={(e) => {
          setDraggingHue(true);
          handleHueInteraction(e.clientX);
        }}
        onTouchStart={(e) => {
          handleHueInteraction(e.touches[0].clientX);
        }}
        onTouchMove={(e) => handleTouchMove(e, "hue")}
      />
      {/* Hue indicator overlay */}
      <div className="relative -mt-4 h-4 pointer-events-none">
        {hasValue && (
          <div
            className="absolute w-1 h-full rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] -translate-x-1/2"
            style={{ left: `${(hsv[0] / 360) * 100}%` }}
          />
        )}
      </div>

      {/* Hex input */}
      <div className="flex items-center gap-2 mt-3">
        <span
          className="size-6 rounded-full border border-border shrink-0"
          style={hasValue ? { backgroundColor: hsvToHex(hsv[0], hsv[1], hsv[2]) } : undefined}
        />
        <Input
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          className="w-28 font-mono text-sm"
          maxLength={7}
          placeholder={hasValue ? "#rrggbb" : t`None`}
        />
        {!collapsible && ((onClear && hasValue) || actions) && (
          <div className="ms-auto flex items-center gap-2">
            {onClear && hasValue && (
              <Button type="button" variant="outline" size="sm" onClick={onClear}>
                <Trans>Clear</Trans>
              </Button>
            )}
            {actions}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
