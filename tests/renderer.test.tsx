import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/renderer/src/App';
import '@testing-library/jest-dom';

describe('React Frontend UI Component', () => {
  it('should render the shell layout with title and navigation links', () => {
    render(<App />);

    // Check application title
    expect(screen.getByText('StudyVault')).toBeInTheDocument();

    // Check sidebar navigation items
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Library')).toBeInTheDocument();
    expect(screen.getByText('Reader')).toBeInTheDocument();
    expect(screen.getByText('Converter')).toBeInTheDocument();
    expect(screen.getByText('Deep Search')).toBeInTheDocument();
    expect(screen.getByText('AI Copilot')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
  });

  it('should navigate between screens when clicking sidebar buttons', () => {
    render(<App />);

    // Click Library nav button
    const libraryNavBtn = screen.getByText('Library');
    fireEvent.click(libraryNavBtn);

    // Verify Library Screen renders title and import file button
    expect(screen.getByText('StudyVault Library')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Document/i })).toBeInTheDocument();

    // Click Converter nav button
    const converterNavBtn = screen.getByText('Converter');
    fireEvent.click(converterNavBtn);

    // Verify Converter Screen renders
    expect(screen.getByText('File Conversion Engine')).toBeInTheDocument();
    expect(screen.getByText('Conversion Setup')).toBeInTheDocument();
  });

  it('should filter library list when typing in local filter input', () => {
    render(<App />);

    // Navigate to Library
    fireEvent.click(screen.getByText('Library'));

    // Check that mock documents are rendering
    expect(screen.getByText('Quantum Physics Lecture 1.pdf')).toBeInTheDocument();
    expect(screen.getByText('Organic Chemistry Lab Notes.docx')).toBeInTheDocument();

    // Type filter keyword
    const filterInput = screen.getByPlaceholderText('Filter library files...');
    fireEvent.change(filterInput, { target: { value: 'Organic' } });

    // Expect Organic Chemistry to be there, and Quantum Physics to be filtered out
    expect(screen.getByText('Organic Chemistry Lab Notes.docx')).toBeInTheDocument();
    expect(screen.queryByText('Quantum Physics Lecture 1.pdf')).not.toBeInTheDocument();
  });

  it('should allow navigation to AI settings and save custom API configs', () => {
    render(<App />);

    // Navigate to Settings
    fireEvent.click(screen.getByText('Settings'));

    expect(screen.getByText('Bring Your Own Key (BYOK)')).toBeInTheDocument();

    // Select provider
    const providerSelect = screen.getByRole('combobox');
    fireEvent.change(providerSelect, { target: { value: 'gemini' } });
    expect(providerSelect).toHaveValue('gemini');

    // Input api key
    const apiKeyInput = screen.getByPlaceholderText('sk-...');
    fireEvent.change(apiKeyInput, { target: { value: 'testkey-12345' } });

    // Click save
    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    // Verify notification is displayed or key is stored in localStorage
    expect(localStorage.getItem('studyvault_apikey')).toBe('testkey-12345');
    expect(localStorage.getItem('studyvault_provider')).toBe('gemini');
  });

  it('should render custom titlebar window controls', () => {
    render(<App />);

    // Custom minimize, maximize/restore, and close buttons
    expect(screen.getByTitle('Minimize')).toBeInTheDocument();
    expect(screen.getByTitle('Maximize')).toBeInTheDocument();
    expect(screen.getByTitle('Close')).toBeInTheDocument();
  });

  it('should render folder controls in Library screen', () => {
    render(<App />);

    // Navigate to Library
    fireEvent.click(screen.getByText('Library'));

    // Check directory import button
    expect(screen.getByText('Import Folder')).toBeInTheDocument();

    // Check All Folders grouping filter
    expect(screen.getByText('All Folders')).toBeInTheDocument();
  });

  it('should support toggling viewer modes between Reader and Layout', () => {
    render(<App />);

    // Navigate to Library
    fireEvent.click(screen.getByText('Library'));

    // Click a file to open Reader screen
    const docItem = screen.getByText('Quantum Physics Lecture 1.pdf');
    fireEvent.click(docItem);

    // Verify Viewer Mode selector controls are available
    const readerViewBtn = screen.getByText('Reader View (Text)');
    const layoutViewBtn = screen.getByText('Layout View (Image)');
    expect(readerViewBtn).toBeInTheDocument();
    expect(layoutViewBtn).toBeInTheDocument();

    // Toggle mode to Layout View
    fireEvent.click(layoutViewBtn);
    expect(layoutViewBtn).toHaveStyle({
      background: 'var(--color-primary)'
    });
  });
});
