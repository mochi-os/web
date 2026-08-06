// Copyright © 2026 Mochisoft OÜ
// SPDX-License-Identifier: Apache-2.0

// The field edit dialog from the design editor, shared by crm and projects.
// Their copies were identical apart from the object type.

import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "../ui/responsive-dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Check, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import type {
  EntityField,
  EntityFieldOption,
} from "../../types/entity-object";

interface EditFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: EntityField | null;
  isSystemField?: boolean;
  options: EntityFieldOption[];
  onUpdate: (updates: Partial<EntityField>) => void | Promise<void>;
  onDelete: () => void;
  onAddOption: () => void;
  onEditOption: (option: EntityFieldOption) => void;
  onDeleteOption: (optionId: string) => void;
}

export function EditFieldDialog({
  open,
  onOpenChange,
  field,
  isSystemField: isSystemFieldProp,
  options,
  onUpdate,
  onDelete,
  onAddOption,
  onEditOption,
  onDeleteOption,
}: EditFieldDialogProps) {
  const [name, setName] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [rows, setRows] = useState(1);
  const [pattern, setPattern] = useState("");
  const [minLength, setMinLength] = useState("");
  const [maxLength, setMaxLength] = useState("");

  useEffect(() => {
    if (field) {
      setName(field.name);
      setFieldId(field.id);
      setRows(field.rows || 1);
      setPattern(field.pattern || "");
      setMinLength(field.minlength ? String(field.minlength) : "");
      setMaxLength(field.maxlength ? String(field.maxlength) : "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field?.id]);

  if (!field) return null;

  const isSystemField = isSystemFieldProp ?? false;

  const handleNameBlur = () => {
    if (name.trim() && name.trim() !== field.name) {
      onUpdate({ name: name.trim() });
    }
  };

  const handleIdBlur = async () => {
    const trimmed = fieldId.trim().toLowerCase();
    if (trimmed && trimmed !== field.id) {
      try {
        await onUpdate({ id: trimmed } as Partial<EntityField>);
      } catch {
        setFieldId(field.id);
      }
    }
  };

  const handleRowsBlur = () => {
    if (field.fieldtype === "text" && rows !== (field.rows || 1)) {
      onUpdate({ rows });
    }
  };

  const handlePatternBlur = () => {
    const trimmed = pattern.trim();
    if (trimmed !== (field.pattern || "")) {
      onUpdate({ pattern: trimmed } as Partial<EntityField>);
    }
  };

  const handleMinLengthBlur = () => {
    const value = parseInt(minLength, 10) || 0;
    if (value !== (field.minlength || 0)) {
      onUpdate({ minlength: value } as Partial<EntityField>);
    }
  };

  const handleMaxLengthBlur = () => {
    const value = parseInt(maxLength, 10) || 0;
    if (value !== (field.maxlength || 0)) {
      onUpdate({ maxlength: value } as Partial<EntityField>);
    }
  };

  const hasFlag = (flag: string) => {
    return (field.flags || "").split(",").filter(Boolean).includes(flag);
  };

  const toggleFlag = (flag: string, checked: boolean) => {
    const current = (field.flags || "").split(",").filter(Boolean);
    const updated = checked
      ? [...current, flag]
      : current.filter((f) => f !== flag);
    onUpdate({ flags: updated.join(",") } as Partial<typeof field>);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-md flex flex-col max-h-[85vh]" showCloseButton={false}>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle><Trans>Edit field</Trans></ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only"><Trans>Edit field settings</Trans></ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="field-name"><Trans>Name</Trans></Label>
            <Input
              id="field-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameBlur}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-id"><Trans>ID</Trans></Label>
            <Input
              id="field-id"
              value={fieldId}
              onChange={(e) => setFieldId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              onBlur={handleIdBlur}
            />
          </div>

          <div className="space-y-2">
            <Label><Trans>Type</Trans></Label>
            <p className="text-sm text-muted-foreground capitalize">{field.fieldtype}</p>
          </div>

          {field.fieldtype === "text" && (
            <div className="space-y-2">
              <Label htmlFor="field-rows"><Trans>Rows</Trans></Label>
              <Input
                id="field-rows"
                type="number"
                min={1}
                max={20}
                value={rows}
                onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                onBlur={handleRowsBlur}
              />
              <p className={`text-xs text-muted-foreground ${rows === 1 ? "" : "invisible"}`}>
                <Trans>Single line of text only</Trans>
              </p>
            </div>
          )}

          {field.fieldtype === "text" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="field-minlength"><Trans>Minimum length</Trans></Label>
                <Input
                  id="field-minlength"
                  type="number"
                  min={0}
                  value={minLength}
                  onChange={(e) => setMinLength(e.target.value)}
                  onBlur={handleMinLengthBlur}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-maxlength"><Trans>Maximum length</Trans></Label>
                <Input
                  id="field-maxlength"
                  type="number"
                  min={0}
                  value={maxLength}
                  onChange={(e) => setMaxLength(e.target.value)}
                  onBlur={handleMaxLengthBlur}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-pattern"><Trans>Pattern (regex)</Trans></Label>
                <Input
                  id="field-pattern"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  onBlur={handlePatternBlur}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label><Trans>Flags</Trans></Label>
            <div className="ps-4 space-y-2">
              {[
                { id: "required", label: <Trans>Required</Trans> },
                { id: "sort", label: <Trans>Allow sort by</Trans> },
              ].map((flag) => (
                <label key={flag.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch
                    checked={hasFlag(flag.id)}
                    onCheckedChange={(checked) => toggleFlag(flag.id, checked)}
                  />
                  {flag.label}
                </label>
              ))}
            </div>
          </div>

          {field.fieldtype === "enumerated" && (
            <div className="space-y-2">
              <Label><Trans>Options</Trans></Label>
              <div className="space-y-1">
                {options.map((opt) => (
                  <div
                    key={opt.id}
                    className="flex items-center justify-between p-2 border rounded"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-3 rounded-full"
                        style={{ backgroundColor: opt.colour }}
                      />
                      <span className="text-sm">{opt.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => onEditOption(opt)}
                            aria-label={t`Edit option ${opt.name}`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t`Edit option ${opt.name}`}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => onDeleteOption(opt.id)}
                            aria-label={t`Delete option ${opt.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t`Delete option ${opt.name}`}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onAddOption}>
                <Plus className="size-3.5" />
                <Trans>Add option</Trans>
              </Button>
            </div>
          )}
        </div>
        <ResponsiveDialogFooter className="justify-between">
          {!isSystemField ? (
            <Button type="button" variant="outline" onClick={onDelete}>
              <Minus className="size-4" />
              <Trans>Delete field</Trans>
            </Button>
          ) : <div />}
          <Button type="button" onClick={() => onOpenChange(false)}>
            <Check className="size-4" />
            <Trans>Done</Trans>
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
