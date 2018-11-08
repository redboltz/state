export namespace assert {
	/**
	 * Tests value to see if it is truthy
	 * @param value The value to test.
	 * @param message A callback to create a message that will be the message of an Error exception.
	 */
	export function ok(value: any, message: () => string): void {
		if (!value) {
			throw new Error(message());
		}
	}
}