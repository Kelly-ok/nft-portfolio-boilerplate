import { NFT } from '@/types';

/**
 * Formats a date value from an NFT attribute
 * @param value The value to format (can be a string or number)
 * @returns An object with formatted time and date strings
 */
export function formatDateValue(value: string | number) {
  // Convert to number if it's a string
  const numValue = typeof value === 'string' ? Number(value) : value;

  // Check if it's a valid number
  if (isNaN(numValue)) {
    return {
      time: 'Invalid date',
      date: 'Invalid date'
    };
  }

  try {
    // Multiply by 1000 if it's in seconds (10 digits or less)
    // Unix timestamps are typically 10 digits for seconds, 13 for milliseconds
    const timestamp = String(numValue).length <= 10 ? numValue * 1000 : numValue;
    const date = new Date(timestamp);

    // Check if it's a valid date in a reasonable range
    if (date.getFullYear() < 1970 || date.getFullYear() > 2100) {
      return {
        time: 'Invalid date',
        date: 'Invalid date'
      };
    }

    // Format the time and date
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    return { time, date: dateStr };
  } catch (e) {
    return {
      time: 'Invalid date',
      date: 'Invalid date'
    };
  }
}

/**
 * Determines if a value is likely a timestamp
 * @param value The value to check
 * @param traitType Optional trait type to help with detection
 * @returns Boolean indicating if the value is likely a timestamp
 */
export function isLikelyTimestamp(value: any, traitType?: string): boolean {
  // If it's not a string or number, it's not a timestamp
  if (typeof value !== 'string' && typeof value !== 'number') {
    return false;
  }

  // Convert to number
  const numValue = Number(value);
  if (isNaN(numValue)) {
    return false;
  }

  // Check if trait type suggests a date
  const isDateTrait = traitType && (
    traitType.toLowerCase().includes('date') ||
    traitType.toLowerCase().includes('time') ||
    traitType.toLowerCase().includes('expir')
  );

  // Check if the number looks like a timestamp
  // Unix timestamps are typically 10 digits for seconds, 13 for milliseconds
  const isTimestampFormat =
    (String(numValue).length === 10 || String(numValue).length === 13) &&
    numValue > 1000000000; // Roughly year 2001 in seconds

  // If either condition is true, it might be a timestamp
  return isDateTrait || isTimestampFormat;
}

/**
 * Gets deduplicated attributes from an NFT
 * @param nft The NFT object
 * @returns An array of unique attributes
 */
export function getUniqueAttributes(nft: NFT): any[] {
  // Create a map to track unique attributes by trait_type and value
  const uniqueAttributes = new Map();
  const result: any[] = [];

  // Helper function to add attributes to our unique collection
  const addUniqueAttributes = (attributes: any[] | undefined): void => {
    if (!attributes || !Array.isArray(attributes) || attributes.length === 0) return;

    attributes.forEach(attr => {
      if (!attr.trait_type) return; // Skip attributes without trait_type

      // Create a unique key for this attribute
      const key = `${attr.trait_type}:${attr.value}`;

      // If we haven't seen this attribute before, add it
      if (!uniqueAttributes.has(key)) {
        uniqueAttributes.set(key, attr);
        result.push(attr);
      }
    });
  };

  // Try to add attributes from each source in order of priority

  // 1. Direct attributes (highest priority)
  if (nft.attributes && Array.isArray(nft.attributes)) {
    addUniqueAttributes(nft.attributes);
  }

  // 2. Normalized metadata attributes (second priority)
  if (nft.metadata && typeof nft.metadata === 'object' && nft.metadata.normalized_metadata?.attributes) {
    addUniqueAttributes(nft.metadata.normalized_metadata.attributes);
  }

  // 3. Metadata attributes (third priority)
  if (nft.metadata && typeof nft.metadata === 'object' && nft.metadata.attributes) {
    addUniqueAttributes(nft.metadata.attributes);
  }

  // 4. String metadata attributes (lowest priority)
  if (nft.metadata && typeof nft.metadata === 'string') {
    try {
      const parsed = JSON.parse(nft.metadata as string);
      if (parsed.attributes && Array.isArray(parsed.attributes)) {
        addUniqueAttributes(parsed.attributes);
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  return result;
}
