import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Pagination,
  PaginationButton,
  PaginationStatus,
  SearchField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toast,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './index';

describe('Phase 2B shared components', () => {
  it('renders the polished shared-component showcase without accessibility violations', async () => {
    const { container } = render(<App />);

    expect(
      screen.getByRole('heading', { name: /clinical intelligence, built around human judgment/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/human-in-the-loop ai/i)).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('opens and closes a focus-managed dialog with keyboard interaction', async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog title</DialogTitle>
          <DialogDescription>Dialog description</DialogDescription>
          <DialogClose asChild>
            <Button>Close dialog</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(screen.getByRole('dialog', { name: 'Dialog title' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Dialog title' })).not.toBeInTheDocument();
  });

  it('supports dropdown menu keyboard navigation and selection', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Open menu</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelect}>First action</DropdownMenuItem>
          <DropdownMenuItem>Second action</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    screen.getByRole('button', { name: 'Open menu' }).focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('exposes tabs and accordion state through accessible semantics', async () => {
    const user = userEvent.setup();

    render(
      <>
        <Tabs defaultValue="one">
          <TabsList aria-label="Demo tabs">
            <TabsTrigger value="one">One</TabsTrigger>
            <TabsTrigger value="two">Two</TabsTrigger>
          </TabsList>
          <TabsContent value="one">Panel one</TabsContent>
          <TabsContent value="two">Panel two</TabsContent>
        </Tabs>
        <Accordion type="single" collapsible>
          <AccordionItem value="item">
            <AccordionTrigger>Open section</AccordionTrigger>
            <AccordionContent>Section content</AccordionContent>
          </AccordionItem>
        </Accordion>
      </>,
    );

    await user.click(screen.getByRole('tab', { name: 'Two' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel two');

    const accordionButton = screen.getByRole('button', { name: 'Open section' });
    expect(accordionButton).toHaveAttribute('aria-expanded', 'false');
    await user.click(accordionButton);
    expect(accordionButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('supports searchable input clearing and semantic data shells', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();

    render(
      <>
        <SearchField aria-label="Search preview" value="query" onChange={() => undefined} onClear={onClear} />
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Column</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Value</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableShell>
        <Pagination>
          <PaginationButton aria-label="Previous page">Previous</PaginationButton>
          <PaginationStatus>Page 1 of 1</PaginationStatus>
          <PaginationButton aria-label="Next page">Next</PaginationButton>
        </Pagination>
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Pagination' })).getByText('Page 1 of 1')).toBeInTheDocument();
  });

  it('keeps the landing composition responsive with mobile and overflow-safe structures', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveClass('overflow-x-hidden');
    expect(screen.getByRole('list', { name: 'AI and OCR workflow' })).toHaveClass('md:grid-cols-5');
  });

  it('renders toast messages through accessible status semantics', () => {
    render(
      <ToastProvider>
        <Toast open>
          <ToastTitle>Preview toast</ToastTitle>
          <ToastDescription>Toast description</ToastDescription>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );

    expect(screen.getByText('Preview toast')).toBeInTheDocument();
    expect(screen.getByText('Toast description')).toBeInTheDocument();
  });
});
