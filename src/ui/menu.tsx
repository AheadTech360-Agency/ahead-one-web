"use client";

import { ContextMenu as ContextPrimitive, DropdownMenu as MenuPrimitive } from "radix-ui";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Dropdown menu and context menu share one look. Radix handles roving focus, typeahead,
 * Escape to close and focus restore to the trigger.
 */

const baseContent =
  "z-[var(--z-popover)] min-w-44 overflow-hidden rounded-md border border-border bg-surface-raised p-1 text-13 text-fg shadow-popover data-[side=top]:[--pop-y:4px] data-[side=bottom]:[--pop-y:-4px] data-[side=left]:[--pop-x:4px] data-[side=right]:[--pop-x:-4px] data-[state=open]:animate-in-pop data-[state=closed]:animate-out-pop";
/* Scale and fade grow from the anchor: Radix exposes the origin as a CSS variable per menu kind. */
const contentClass = baseContent + " origin-[var(--radix-dropdown-menu-content-transform-origin)]";
const contextContentClass = baseContent + " origin-[var(--radix-context-menu-content-transform-origin)]";

const itemClass =
  "relative flex h-8 cursor-default select-none items-center gap-2 rounded-xs px-2 outline-none " +
  "data-[highlighted]:bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-50 " +
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-faint";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuSub = MenuPrimitive.Sub;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 4,
  align = "start",
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(contentClass, className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  danger,
  shortcut,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item> & { danger?: boolean; shortcut?: string }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        itemClass,
        danger && "text-danger-text [&_svg]:text-danger-text data-[highlighted]:bg-danger-subtle",
        className,
      )}
      {...props}
    >
      {shortcut ? (
        <>
          {children}
          <span className="ml-auto pl-4 text-12 text-fg-faint">{shortcut}</span>
        </>
      ) : (
        children
      )}
    </MenuPrimitive.Item>
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.RadioItem>) {
  return (
    <MenuPrimitive.RadioItem className={cn(itemClass, "pr-8", className)} {...props}>
      {children}
      <MenuPrimitive.ItemIndicator className="absolute right-2 flex">
        <Check className="!text-accent" aria-hidden />
      </MenuPrimitive.ItemIndicator>
    </MenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label
      className={cn("px-2 pb-1 pt-1.5 text-12 text-fg-muted", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <MenuPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} />;
}

export function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubTrigger>) {
  return (
    <MenuPrimitive.SubTrigger
      className={cn(itemClass, "data-[state=open]:bg-hover", className)}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto" aria-hidden />
    </MenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.SubContent>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.SubContent sideOffset={6} className={cn(contentClass, className)} {...props} />
    </MenuPrimitive.Portal>
  );
}

/* ---------- Context menu ---------- */

export const ContextMenu = ContextPrimitive.Root;
export const ContextMenuTrigger = ContextPrimitive.Trigger;

export function ContextMenuContent({
  className,
  ...props
}: React.ComponentProps<typeof ContextPrimitive.Content>) {
  return (
    <ContextPrimitive.Portal>
      <ContextPrimitive.Content className={cn(contextContentClass, className)} {...props} />
    </ContextPrimitive.Portal>
  );
}

export function ContextMenuItem({
  className,
  danger,
  ...props
}: React.ComponentProps<typeof ContextPrimitive.Item> & { danger?: boolean }) {
  return (
    <ContextPrimitive.Item
      className={cn(
        itemClass,
        danger && "text-danger-text [&_svg]:text-danger-text data-[highlighted]:bg-danger-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function ContextMenuSeparator() {
  return <ContextPrimitive.Separator className="-mx-1 my-1 h-px bg-border" />;
}

/** Multi-select row: stays open on select (pass onSelect={(e) => e.preventDefault()}). */
export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.CheckboxItem>) {
  return (
    <MenuPrimitive.CheckboxItem className={cn(itemClass, "pr-8", className)} {...props}>
      {children}
      <MenuPrimitive.ItemIndicator className="absolute right-2 flex">
        <Check className="!text-accent" aria-hidden />
      </MenuPrimitive.ItemIndicator>
    </MenuPrimitive.CheckboxItem>
  );
}
