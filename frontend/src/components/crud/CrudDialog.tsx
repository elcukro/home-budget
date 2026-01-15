"use client";

import * as React from "react";
import { useEffect } from "react";
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
  mode,
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
  const { settings } = useSettings();

  // Get currency symbol for display
  const getCurrencySymbol = () => {
    if (!settings?.currency) return '';
    try {
      const formatted = new Intl.NumberFormat(settings.language || 'en', {
        style: 'currency',
        currency: settings.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(0);
      // Extract just the symbol by removing the number
      return formatted.replace(/[\d\s.,]/g, '').trim();
    } catch {
      return settings.currency;
    }
  };

  const currencySymbol = getCurrencySymbol();

  const form = useForm<TFormValues>({
    resolver: zodResolver(schema as any) as Resolver<TFormValues>,
    defaultValues: defaultValues as DefaultValues<TFormValues>,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (open) {
      form.reset({ ...defaultValues, ...initialValues } as DefaultValues<TFormValues>);
    } else {
      form.reset(defaultValues as DefaultValues<TFormValues>);
    }
  }, [open, initialValues, defaultValues, form]);

  const handleSubmit = async (values: TFormValues) => {
    await onSubmit(values);
  };

  // Watch all form values to enable conditional field rendering
  const watchedValues = form.watch();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
            noValidate
          >
            {fields
              .filter((fieldConfig) =>
                !fieldConfig.showWhen || fieldConfig.showWhen(watchedValues as TFormValues)
              )
              .map((fieldConfig) => (
              <FormField
                key={fieldConfig.name}
                control={form.control}
                name={fieldConfig.name}
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>
                      {intl.formatMessage({ id: fieldConfig.labelId })}
                    </FormLabel>
                    <FormControl>
                      {fieldConfig.component === "icon-select" ? (
                        <div className="grid grid-cols-3 gap-2">
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
                                className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all ${
                                  isSelected
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-muted hover:border-primary/50 hover:bg-muted/50"
                                }`}
                              >
                                <span className={`flex h-10 w-10 items-center justify-center rounded-full ${
                                  isSelected ? "bg-primary/20" : "bg-muted"
                                }`}>
                                  {option.icon}
                                </span>
                                <span className="text-xs font-medium">
                                  {intl.formatMessage({ id: option.labelId })}
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
                                {intl.formatMessage({ id: option.labelId })}
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
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                            {currencySymbol}
                          </span>
                          <Input
                            {...field}
                            onChange={(event) => {
                              // Allow comma as decimal separator
                              const rawValue = event.target.value.replace(',', '.');
                              field.onChange(rawValue);
                              fieldConfig.onValueChange?.(rawValue, form);
                            }}
                            type="text"
                            inputMode="decimal"
                            value={
                              field.value === undefined ||
                              field.value === null ||
                              (mode === "create" &&
                                (field.value === 0 ||
                                  field.value === "0" ||
                                  field.value === "0.0"))
                                ? ""
                                : String(field.value).replace('.', settings?.language === 'pl' ? ',' : '.')
                            }
                            className="pl-10"
                            step={fieldConfig.step || "0.01"}
                            min={fieldConfig.min}
                            max={fieldConfig.max}
                            disabled={fieldConfig.disabled}
                            autoFocus={fieldConfig.autoFocus}
                            placeholder={
                              fieldConfig.placeholderId
                                ? intl.formatMessage({
                                    id: fieldConfig.placeholderId,
                                  })
                                : "0,00"
                            }
                          />
                        </div>
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
                              ? field.value === undefined ||
                                field.value === null ||
                                (mode === "create" &&
                                  (field.value === 0 ||
                                    field.value === "0" ||
                                    field.value === "0.0"))
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
                    {fieldConfig.descriptionId && (
                      <p className="text-sm text-muted-foreground">
                        {intl.formatMessage({ id: fieldConfig.descriptionId })}
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

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
