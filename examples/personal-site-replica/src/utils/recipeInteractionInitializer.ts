import {
  formatQuantityDisplay,
  formatTimerQuantity,
  isTimeUnit,
} from './recipeQuantityDisplay';
import { isMetricUnit } from './recipeUnitConversion';

let controller: AbortController | null = null;

function getIngredientNameFromListItem(ingredient: Element): string {
  const clone = ingredient.cloneNode(true) as Element;
  clone.querySelector('.quantity')?.remove();
  return clone.textContent?.trim() ?? '';
}

function setButtonState(button: Element, active: boolean): void {
  if (active) {
    button.setAttribute('data-active', '');
    button.setAttribute('aria-pressed', 'true');
    return;
  }
  button.removeAttribute('data-active');
  button.setAttribute('aria-pressed', 'false');
}

export function initRecipeInteraction(): void {
  // Cleanup previous listeners (covers re-init across view transitions).
  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;

  const ingredientsList = document.getElementById('ingredients-list');
  const scaleButtons = document.querySelectorAll('[data-scale]');
  const unitButtons = document.querySelectorAll('[data-unit]');
  const unitToggle = document.getElementById(
    'unit-toggle',
  ) as HTMLInputElement | null;
  const customScaleInput = document.getElementById(
    'custom-scale',
  ) as HTMLInputElement | null;
  const recipeSteps = document.querySelectorAll('.recipe-step');

  let currentScale = 1; // Default to 1x scale
  let isMetric = isMetricUnit(
    ingredientsList?.querySelector('li')?.getAttribute('data-original-units') ||
      '',
  );

  function updateScaleButtonState(scaleValue: string) {
    scaleButtons.forEach((button) => {
      setButtonState(
        button,
        (button as HTMLElement).dataset.scale === scaleValue,
      );
    });
  }

  function updateUnitButtonState(metric: boolean) {
    const activeUnit = metric ? 'metric' : 'imperial';
    unitButtons.forEach((button) => {
      setButtonState(
        button,
        (button as HTMLElement).dataset.unit === activeUnit,
      );
    });
  }

  function updateIngredients() {
    if (!ingredientsList) return;

    const ingredients = ingredientsList.querySelectorAll('li');
    ingredients.forEach((ingredient) => {
      if (ingredient.getAttribute('data-has-display-quantity') === 'false') {
        return;
      }
      const originalQuantity = ingredient.getAttribute(
        'data-original-quantity',
      );
      const originalUnits =
        ingredient.getAttribute('data-original-units') || '';
      const ingredientName =
        ingredient.getAttribute('data-name') ||
        getIngredientNameFromListItem(ingredient);
      const quantitySpan = ingredient.querySelector('.quantity');
      if (!quantitySpan) return;

      const display = formatQuantityDisplay({
        ingredientName,
        isMetric,
        quantity: originalQuantity,
        scale: currentScale,
        units: originalUnits,
      });
      quantitySpan.textContent = display.quantityText;
    });
  }

  function updateRecipeSteps() {
    recipeSteps.forEach((step) => {
      const ingredients = step.querySelectorAll('.ingredient');
      ingredients.forEach((ingredient) => {
        if (ingredient.getAttribute('data-has-display-quantity') === 'false') {
          return;
        }
        const originalQuantity = ingredient.getAttribute(
          'data-original-quantity',
        );
        const originalUnits =
          ingredient.getAttribute('data-original-units') || '';
        const ingredientName = ingredient.getAttribute('data-name') || '';
        const originalText = ingredient.querySelector('.original-text');
        const convertedText = ingredient.querySelector('.converted-text');
        if (!originalText || !convertedText) return;

        const display = formatQuantityDisplay({
          ingredientName,
          isMetric,
          quantity: originalQuantity,
          scale: currentScale,
          units: originalUnits,
        });

        if (!display.changed || isTimeUnit(originalUnits)) {
          originalText.classList.remove('hidden');
          convertedText.classList.add('hidden');
          return;
        }

        originalText.classList.add('hidden');
        convertedText.classList.remove('hidden');

        convertedText.textContent =
          `${display.quantityText} ${ingredientName}`.trim();
      });

      const timers = step.querySelectorAll('.timer');
      timers.forEach((timer) => {
        const originalUnits = timer.getAttribute('data-original-units') || '';
        const originalText = timer.querySelector('.original-text');
        const convertedText = timer.querySelector('.converted-text');
        if (!originalText || !convertedText) return;

        // Timers describe process duration, not ingredient quantity - no scaling.
        originalText.classList.add('hidden');
        convertedText.classList.remove('hidden');
        convertedText.textContent = formatTimerQuantity(
          timer.getAttribute('data-original-quantity'),
          originalUnits,
        );
      });
    });
  }

  function updateAll() {
    updateIngredients();
    updateRecipeSteps();
  }

  scaleButtons.forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        const scale = (button as HTMLElement).dataset.scale;
        if (scale) {
          currentScale = parseFloat(scale);
          if (customScaleInput) {
            customScaleInput.value = scale;
          }
          updateScaleButtonState(scale);
          updateAll();
        }
      },
      { signal },
    );
  });

  if (unitToggle) {
    unitToggle.checked = isMetric;
    updateUnitButtonState(isMetric);
    unitToggle.addEventListener(
      'change',
      () => {
        isMetric = unitToggle.checked;
        updateUnitButtonState(isMetric);
        updateAll();
      },
      { signal },
    );
  }

  unitButtons.forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        isMetric = (button as HTMLElement).dataset.unit === 'metric';
        if (unitToggle) {
          unitToggle.checked = isMetric;
        }
        updateUnitButtonState(isMetric);
        updateAll();
      },
      { signal },
    );
  });

  if (customScaleInput) {
    customScaleInput.addEventListener(
      'input',
      () => {
        const customScale = parseFloat(customScaleInput.value);
        if (!Number.isNaN(customScale) && customScale > 0) {
          currentScale = customScale;
          updateScaleButtonState(customScaleInput.value);
          updateAll();
        }
      },
      { signal },
    );
  }

  // Initial update
  updateAll();
}

export function destroyRecipeInteraction(): void {
  controller?.abort();
  controller = null;
}
