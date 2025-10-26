/**
 * Abstraction layer for storage to allow components to work outside of the Chrome Extension environment (e.g., in Storybook).
 */

const hasChromeStorage = window.chrome && window.chrome.storage;

/**
 * Loads tasks from the most appropriate storage.
 * @param {function} callback - The callback to execute with the result.
 */
export const loadTasks = (callback) => {
  if (hasChromeStorage) {
    window.chrome.storage.local.get(['tasks'], callback);
  } else {
    // Mock for Storybook/web environment
    console.log('Using localStorage for loading tasks (Storybook mode).');
    try {
      const localTasks = localStorage.getItem('tasks');
      // The callback expects an object like { tasks: [...] }
      callback({ tasks: localTasks ? JSON.parse(localTasks) : [] });
    } catch (e) {
      console.error('Failed to parse tasks from localStorage:', e);
      callback({ tasks: [] });
    }
  }
};

/**
 * Saves tasks to the most appropriate storage.
 * @param {Array} tasks - The tasks array to save.
 */
export const saveTasks = (tasks) => {
  if (hasChromeStorage) {
    window.chrome.storage.local.set({ tasks });
  } else {
    // Mock for Storybook/web environment
    console.log('Using localStorage for saving tasks (Storybook mode).');
    try {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch (e) {
      console.error('Failed to save tasks to localStorage:', e);
    }
  }
};
