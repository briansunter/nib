import { defineBehaviorClient } from '@briansunter/nib/client/behaviors'
import {
  destroyRecipeInteraction,
  initRecipeInteraction,
} from '../utils/recipeInteractionInitializer'

export default defineBehaviorClient('recipe-controls', () => {
  initRecipeInteraction()
  return destroyRecipeInteraction
})
