"use client";

import * as React from "react";
import { useLayoutEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useIntl } from "react-intl";
import { useSettings } from "@/contexts/SettingsContext";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  type FieldValues,
  type Path,
  type Resolver,
  type DefaultValues,
  type UseFormReturn,
} from "react-hook-form";
import type { ZodType } from "zod";

type FieldComponent =
  | "text"
  | "number"
  | "date"
  | "select"
  | "textarea"
  | "switch"
  | "checkbox"
  | "icon-select"
  | "currency";

interface FieldOption {
  value: string;
  labelId: string;
  label?: string;  // If set, used instead of labelId
  icon?: React.ReactNode;
}

export interface FormFieldConfig<TFormValues extends FieldValues> {
  name: Path<TFormValues>;
  labelId: string;
  component: FieldComponent;
  descriptionId?: string;
  placeholderId?: string;
  options?: FieldOption[];
  disabled?: boolean;
  step?: string;
  min?: number;
  max?: number;
  autoFocus?: boolean;
  onValueChange?: (value: unknown, form: UseFormReturn<TFormValues>) => void;
  showWhen?: (values: TFormValues) => boolean;
  /** For icon-select: number of columns (default 3) */
  columns?: number;
  /** For icon-select: compact horizontal layout (icon + text side by side) */
  compact?: boolean;
  /** Group fields into same row - fields with same rowGroup value render side by side */
  rowGroup?: string;
  /** Width within row group: "auto" | "1/2" | "1/3" | "2/3" (default "1/2") */
  rowWidth?: "auto" | "1/2" | "1/3" | "2/3";
  /** Render extra content below this field (e.g. tax breakdown preview) */
  renderExtra?: (form: UseFormReturn<TFormValues>) => React.ReactNode;
}

export interface CrudDialogProps<TFormValues extends FieldValues> {
  open: boolean;
  mode: "create" | "edit";
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId?: string;
  submitLabelId: string;
  cancelLabelId?: string;
  schema: ZodType<TFormValues>;
  defaultValues: TFormValues;
  initialValues?: Partial<TFormValues>;
  fields: FormFieldConfig<TFormValues>[];
  onSubmit: (values: TFormValues) => Promise<void> | void;
  isSubmitting?: boolean;
}

export function CrudDialog<TFormValues extends FieldValues>({
  open,
  onOpenChange,
  titleId,
  descriptionId,
  submitLabelId,
  cancelLabelId = "common.cancel",
  schema,
  defaultValues,
  initialValues,
  fields,
  onSubmit,
  isSubmitting = false,
}: CrudDialogProps<TFormValues>) {
  const intl = useIntl();
  const { settings: _settings } = useSettings();

  const form = useForm<TFormValues>({
    resolver: zodResolver(schema as any) as Resolver<TFormValues>,
    defaultValues: defaultValues as DefaultValues<TFormValues>,
    mode: "onSubmit",
  });

  useLayoutEffect(() => {
    if (open) {
      form.reset({ ...defaultValues, ...initialValues } as DefaultValues<TFormValues>);
    } else {
      form.reset(defaultValues as DefaultValues<TFormValues>);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async (values: TFormValues) => {
    await onSubmit(values);
  };

  const onFormError = (errors: any) => {
    console.error("[CrudDialog] Form validation errors:", errors);
    Object.entries(errors).forEach(([field, error]: [string, any]) => {
      console.error(`  - ${field}: ${error?.message || JSON.stringify(error)}`);
    });
  };

  // eslint-disable-next-line react-hooks/incompatible-library -- form.watch() is needed for conditional field rendering
  const watchedValues = form.watch();

  const groupedFields = React.useMemo(() => {
    const visibleFields = fields.filter(
      (f) => !f.showWhen || f.showWhen(watchedValues as TFormValues)
    );

    const groups: { key: string; fields: FormFieldConfig<TFormValues>[] }[] = [];
    const processedIndices = new Set<number>();

    visibleFields.forEach((field, index) => {
      if (processedIndices.has(index)) return;

      if (field.rowGroup) {
        const groupFields = visibleFields
          .map((f, i) => ({ field: f, index: i }))
          .filter(({ field: f }) => f.rowGroup === field.rowGroup);

        groupFields.forEach(({ index: i }) => processedIndices.add(i));
        groups.push({
          key: `row-${field.rowGroup}`,
          fields: groupFields.map(({ field: f }) => f),
        });
      } else {
        processedIndices.add(index);
        groups.push({
          key: `single-${field.name}`,
          fields: [field],
        });
      }
    });

    return groups;
  }, [fields, watchedValues]);

  const getRowWidthClass = (width?: string) => {
    switch (width) {
      case "1/3": return "w-1/3";
      case "2/3": return "w-2/3";
      case "auto": return "flex-1";
      default: return "w-1/2";
    }
  };

  const renderFieldContent = (fieldConfig: FormFieldConfig<TFormValues>) => (
    <FormField
      control={form.control}
      name={fieldConfig.name}
      render={({ field }) => {
        const isToggle = fieldConfig.component === "switch" || fieldConfig.component === "checkbox";
        return (
          <FormItem className={isToggle ? "flex items-center justify-between gap-4 rounded-lg border p-3" : undefined}>
            {isToggle ? (
              <div className="space-y-0.5">
                <FormLabel className="text-sm font-medium cursor-pointer">
                  {intl.formatMessage({ id: fieldConfig.labelId })}
                </FormLabel>
                {fieldConfig.descriptionId && (
                  <p className="text-xs text-muted-foreground">
                    {intl.formatMessage({ id: fieldConfig.descriptionId })}
                  </p>
                )}
              </div>
            ) : (
              <FormLabel>
                {intl.formatMessage({ id: fieldConfig.labelId })}
              </FormLabel>
            )}
            <FormControl>
              {fieldConfig.component === "icon-select" ? (
                <div className={`grid gap-2 ${
                  fieldConfig.columns === 2 ? "grid-cols-2" :
                  fieldConfig.columns === 4 ? "grid-cols-4" :
                  "grid-cols-3"
                }`}>
                  {fieldConfig.options?.map((option) => {
                    const isSelected = field.value === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          field.onChange(option.value);
                          fieldConfig.onValueChange?.(option.value, form);
                        }}
                        className={`flex ${fieldConfig.compact ? "flex-row gap-2 p-2" : "flex-col gap-2 p-3"} items-center rounded-xl border-2 transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-muted hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        <span className={`flex items-center justify-center rounded-full ${
                          fieldConfig.compact ? "h-8 w-8" : "h-10 w-10"
                        } ${isSelected ? "bg-primary/20" : "bg-muted"}`}>
                          {option.icon}
                        </span>
                        <span className={`${fieldConfig.compact ? "text-sm" : "text-xs"} font-medium`}>
                          {option.label || intl.formatMessage({ id: option.labelId })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : fieldConfig.component === "select" ? (
                <Select
                  disabled={fieldConfig.disabled}
                  onValueChange={(value) => {
                    field.onChange(value);
                    fieldConfig.onValueChange?.(value, form);
                  }}
                  value={
                    field.value === undefined ||
                    field.value === null ||
                    field.value === ""
                      ? undefined
                      : String(field.value)
                  }
                >
                  <SelectTrigger autoFocus={fieldConfig.autoFocus}>
                    <SelectValue
                      placeholder={
                        fieldConfig.placeholderId
                          ? intl.formatMessage({
                              id: fieldConfig.placeholderId,
                            })
                          : undefined
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {fieldConfig.options?.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                      >
                        {option.label || intl.formatMessage({ id: option.labelId })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : fieldConfig.component === "switch" ? (
                <Switch
                  checked={Boolean(field.value)}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    fieldConfig.onValueChange?.(checked, form);
                  }}
                  disabled={fieldConfig.disabled}
                />
              ) : fieldConfig.component === "checkbox" ? (
                <Checkbox
                  checked={Boolean(field.value)}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    fieldConfig.onValueChange?.(checked, form);
                  }}
                  disabled={fieldConfig.disabled}
                />
              ) : fieldConfig.component === "textarea" ? (
                <Textarea
                  {...field}
                  onChange={(event) => {
                    field.onChange(event);
                    fieldConfig.onValueChange?.(
                      event.target.value,
                      form,
                    );
                  }}
                  value={(field.value as string) ?? ""}
                  disabled={fieldConfig.disabled}
                  autoFocus={fieldConfig.autoFocus}
                  placeholder={
                    fieldConfig.placeholderId
                      ? intl.formatMessage({
                          id: fieldConfig.placeholderId,
                        })
                      : undefined
                  }
                />
              ) : fieldConfig.component === "currency" ? (
                <CurrencyInput
                  value={Number(field.value) || 0}
                  onValueChange={(val) => {
                    field.onChange(val);
                    fieldConfig.onValueChange?.(String(val), form);
                  }}
                  disabled={fieldConfig.disabled}
                  autoFocus={fieldConfig.autoFocus}
                  placeholder={
                    fieldConfig.placeholderId
                      ? intl.formatMessage({
                          id: fieldConfig.placeholderId,
                        })
                      : undefined
                  }
                />
              ) : (
                <Input
                  {...field}
                  onChange={(event) => {
                    field.onChange(event);
                    fieldConfig.onValueChange?.(
                      event.target.value,
                      form,
                    );
                  }}
                  type={
                    fieldConfig.component === "number"
                      ? "number"
                      : fieldConfig.component === "date"
                        ? "date"
                        : "text"
                  }
                  value={
                    fieldConfig.component === "number"
                      ? field.value === undefined || field.value === null || field.value === ""
                        ? ""
                        : (field.value as string | number)
                      : (field.value as string | number) ?? ""
                  }
                  inputMode={
                    fieldConfig.component === "number"
                      ? "decimal"
                      : undefined
                  }
                  step={fieldConfig.step}
                  min={fieldConfig.min}
                  max={fieldConfig.max}
                  disabled={fieldConfig.disabled}
                  autoFocus={fieldConfig.autoFocus}
                  placeholder={
                    fieldConfig.placeholderId
                      ? intl.formatMessage({
                          id: fieldConfig.placeholderId,
                        })
                      : undefined
                  }
                />
              )}
            </FormControl>
            {!isToggle && fieldConfig.descriptionId && (
              <p className="text-sm text-muted-foreground">
                {intl.formatMessage({ id: fieldConfig.descriptionId })}
              </p>
            )}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );

  const renderField = (fieldConfig: FormFieldConfig<TFormValues>) => {
    const extra = fieldConfig.renderExtra?.(form);
    if (extra) {
      return (
        <React.Fragment key={fieldConfig.name}>
          {renderFieldContent(fieldConfig)}
          {extra}
        </React.Fragment>
      );
    }
    return <React.Fragment key={fieldConfig.name}>{renderFieldContent(fieldConfig)}</React.Fragment>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{intl.formatMessage({ id: titleId })}</DialogTitle>
          {descriptionId && (
            <DialogDescription>
              {intl.formatMessage({ id: descriptionId })}
            </DialogDescription>
          )}
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit, onFormError)}
            className="space-y-4"
            noValidate
          >
            {Object.keys(form.formState.errors).length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium mb-1">Popraw b&#322;&#281;dy w formularzu:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {Object.entries(form.formState.errors).map(([field, error]: [string, any]) => (
                    <li key={field}>{field}: {error?.message || "Nieprawid\u0142owa warto\u015b\u0107"}</li>
                  ))}
                </ul>
              </div>
            )}
            {groupedFields.map((group) =>
              group.fields.length === 1 ? (
                renderField(group.fields[0])
              ) : (
                <div key={group.key} className="flex gap-3">
                  {group.fields.map((fieldConfig) => (
                    <div
                      key={fieldConfig.name}
                      className={getRowWidthClass(fieldConfig.rowWidth)}
                    >
                      {renderField(fieldConfig)}
                    </div>
                  ))}
                </div>
              )
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {intl.formatMessage({ id: cancelLabelId })}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {intl.formatMessage({ id: submitLabelId })}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
