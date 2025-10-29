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
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldValues, type Path } from "react-hook-form";
import type { ZodType } from "zod";

type FieldComponent =
  | "text"
  | "number"
  | "date"
  | "select"
  | "textarea"
  | "switch"
  | "checkbox";

interface FieldOption {
  value: string;
  labelId: string;
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

  const form = useForm<TFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    if (open) {
      form.reset({ ...defaultValues, ...initialValues });
    } else {
      form.reset(defaultValues);
    }
  }, [open, initialValues, defaultValues, form]);

  const handleSubmit = async (values: TFormValues) => {
    await onSubmit(values);
  };

  const renderField = (fieldConfig: FormFieldConfig<TFormValues>) => {
    const { component, options, placeholderId, step, min, max, disabled } =
      fieldConfig;

    switch (component) {
      case "textarea":
        return (
          <Textarea
            disabled={disabled}
            placeholder={
              placeholderId
                ? intl.formatMessage({ id: placeholderId })
                : undefined
            }
          />
        );
      case "select":
        return (
          <Select disabled={disabled}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  placeholderId
                    ? intl.formatMessage({ id: placeholderId })
                    : undefined
                }
              />
            </SelectTrigger>
            <SelectContent>
              {options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {intl.formatMessage({ id: option.labelId })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "switch":
        return <Switch disabled={disabled} />;
      case "checkbox":
        return <Checkbox disabled={disabled} />;
      case "date":
        return <Input type="date" disabled={disabled} />;
      case "number":
        return (
          <Input
            type="number"
            step={step}
            min={min}
            max={max}
            disabled={disabled}
            inputMode="decimal"
          />
        );
      case "text":
      default:
        return (
          <Input
            disabled={disabled}
            placeholder={
              placeholderId
                ? intl.formatMessage({ id: placeholderId })
                : undefined
            }
          />
        );
    }
  };

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
            {fields.map((fieldConfig) => (
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
                      {fieldConfig.component === "select" ? (
                        <Select
                          disabled={fieldConfig.disabled}
                          onValueChange={field.onChange}
                          value={
                            field.value === undefined ||
                            field.value === null ||
                            field.value === ""
                              ? undefined
                              : String(field.value)
                          }
                        >
                          <SelectTrigger>
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
                          onCheckedChange={field.onChange}
                          disabled={fieldConfig.disabled}
                        />
                      ) : fieldConfig.component === "checkbox" ? (
                        <Checkbox
                          checked={Boolean(field.value)}
                          onCheckedChange={field.onChange}
                          disabled={fieldConfig.disabled}
                        />
                      ) : fieldConfig.component === "textarea" ? (
                        <Textarea
                          {...field}
                          value={(field.value as string) ?? ""}
                          disabled={fieldConfig.disabled}
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
                    <FormMessage>
                      {fieldState.error?.message
                        ? intl.formatMessage({
                            id: fieldState.error.message,
                            defaultMessage: fieldState.error.message,
                          })
                        : null}
                    </FormMessage>
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
