# HEML Test Project

## Overview

This is a test project for experimenting with HEML (HTML Email Markup Language).

## Development

- Run `npm install` to install dependencies
- Run `npm run build` to build email templates
- Run `npm test` to run tests

## Conventions

- Keep email templates in the `src/` directory
- Use HEML syntax for all email templates
- Test emails across major clients before merging

## Examples

### Basic HEML template

```heml
<heml>
  <head>
    <subject>Welcome!</subject>
  </head>
  <body>
    <container>
      <row>
        <column>
          <h1>Hello World</h1>
          <p>Welcome to our service.</p>
          <button href="https://example.com">Get Started</button>
        </column>
      </row>
    </container>
  </body>
</heml>
```

### Two-column layout

```heml
<heml>
  <head>
    <subject>Newsletter</subject>
  </head>
  <body>
    <container>
      <row>
        <column large="6" small="12">
          <h2>Left Column</h2>
          <p>Content for the left side.</p>
        </column>
        <column large="6" small="12">
          <h2>Right Column</h2>
          <p>Content for the right side.</p>
        </column>
      </row>
    </container>
  </body>
</heml>
```

### Styled button

```heml
<heml>
  <head>
    <subject>Action Required</subject>
    <style>
      button {
        background-color: #2563eb;
        border-radius: 6px;
        padding: 12px 24px;
      }
    </style>
  </head>
  <body>
    <container>
      <row>
        <column>
          <p>Please confirm your email address.</p>
          <button href="https://example.com/confirm">Confirm Email</button>
        </column>
      </row>
    </container>
  </body>
</heml>
```

hello

hello

hello

hello

test
