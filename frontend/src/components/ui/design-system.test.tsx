import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import {
  Button,
  Checkbox,
  FormField,
  FormMessage,
  IconButton,
  Input,
  Label,
  Progress,
  SkipLink,
  Switch,
} from './index';

describe('Phase 2A design-system foundation', () => {
  it('renders the non-production component showcase without accessibility violations', async () => {
    const { container } = render(<App />);

    expect(screen.getByRole('heading', { name: /navigation, overlays, data shells/i })).toBeInTheDocument();
    expect(screen.getByText(/no domain data is rendered in phase 2b/i)).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard activation for Button', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Confirm</Button>);

    const button = screen.getByRole('button', { name: 'Confirm' });
    button.focus();
    await user.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('requires an accessible name for IconButton through its props', () => {
    render(
      <IconButton aria-label="Open settings">
        <span aria-hidden="true">S</span>
      </IconButton>,
    );

    expect(screen.getByRole('button', { name: 'Open settings' })).toBeInTheDocument();
  });

  it('associates form labels, descriptions, and selectable controls', () => {
    render(
      <FormField>
        <Label htmlFor="sample-input">Sample input</Label>
        <Input id="sample-input" aria-describedby="sample-help" />
        <FormMessage id="sample-help">Helpful form guidance.</FormMessage>
        <Label>
          <Checkbox aria-label="Sample checkbox" /> Agree
        </Label>
        <Switch aria-label="Sample switch" checked />
      </FormField>,
    );

    expect(screen.getByLabelText('Sample input')).toHaveAccessibleDescription('Helpful form guidance.');
    expect(screen.getByRole('checkbox', { name: 'Sample checkbox' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Sample switch' })).toHaveAttribute('aria-checked', 'true');
  });

  it('exposes progressbar values for assistive technology', () => {
    render(<Progress value={42} aria-label="Upload progress" />);

    const progress = screen.getByRole('progressbar', { name: 'Upload progress' });
    expect(progress).toHaveAttribute('aria-valuemin', '0');
    expect(progress).toHaveAttribute('aria-valuemax', '100');
    expect(progress).toHaveAttribute('aria-valuenow', '42');
  });

  it('provides a skip link targeting main content', () => {
    render(<SkipLink>Skip content</SkipLink>);

    expect(screen.getByRole('link', { name: 'Skip content' })).toHaveAttribute('href', '#main-content');
  });
});
