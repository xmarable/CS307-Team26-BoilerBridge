 
// logic to swap outdoor spots for indoor ones
export const generateRainyDayPlan = (primaryItinerary: any[]) => {
  return primaryItinerary.map((activity) => {
    if (!activity.isOutdoor) {
      return { ...activity };
    }

    // fallback logic: if outdoor, try to find indoor alt or default to coffee shop
    // in a real api call we would fetch based on category
    const hasIndoorAlt = false; // mock check

    if (hasIndoorAlt) {
      return {
        ...activity,
        name: `Indoor ${activity.category}`,
        isOutdoor: false,
      };
    }

    // AC: "suggests a generic fallback like a Coffee Shop"
    return {
      ...activity,
      name: "Local Coffee Shop",
      category: "Food & Drink",
      isOutdoor: false,
      location: "Nearby central area",
    };
  });
};
