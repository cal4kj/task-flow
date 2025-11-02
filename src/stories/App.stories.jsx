import React from 'react';
import App from '../App';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

// This is the default export that tells Storybook about our component
export default {
  title: 'Task Flow App',
  component: App,
  parameters: {
    // Optional: makes the component fill the entire Storybook canvas
    layout: 'fullscreen',
  },
};

// This is a named export that represents a specific state of the component
export const Default = () => <App />;
