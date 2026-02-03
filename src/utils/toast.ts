import Toast from 'react-native-toast-message';

// ============ Toast Helper Functions ============

/**
 * Show success toast
 */
export const showSuccess = (message: string, title = 'Success') => {
  Toast.show({
    type: 'success',
    text1: title,
    text2: message,
    position: 'top',
    visibilityTime: 3000,
    topOffset: 50,
  });
};

/**
 * Show error toast
 */
export const showError = (message: string, title = 'Error') => {
  Toast.show({
    type: 'error',
    text1: title,
    text2: message,
    position: 'top',
    visibilityTime: 4000,
    topOffset: 50,
  });
};

/**
 * Show info toast
 */
export const showInfo = (message: string, title = 'Info') => {
  Toast.show({
    type: 'info',
    text1: title,
    text2: message,
    position: 'top',
    visibilityTime: 3000,
    topOffset: 50,
  });
};

/**
 * Show warning toast
 */
export const showWarning = (message: string, title = 'Warning') => {
  Toast.show({
    type: 'info', // react-native-toast-message doesn't have 'warning' by default
    text1: title,
    text2: message,
    position: 'top',
    visibilityTime: 3000,
    topOffset: 50,
  });
};

/**
 * Hide current toast
 */
export const hideToast = () => {
  Toast.hide();
};
