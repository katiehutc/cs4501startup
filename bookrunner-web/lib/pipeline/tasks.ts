import type { Extraction } from "../contracts";
import { addDays } from "../dates";
import type { Task } from "../types";

export function tasksFromExtraction(extraction: Extraction, contactId: string): Task[] {
  const { contact, chatDate, followUp } = extraction;
  const tasks: Task[] = [
    {
      id: `${contactId}-thank-you`,
      contactId,
      kind: "thank_you",
      due: addDays(chatDate, 1),
      label: `Send ${contact.name} a thank-you`,
    },
  ];
  if (followUp !== null) {
    tasks.push({
      id: `${contactId}-follow-up`,
      contactId,
      kind: "follow_up",
      due: addDays(chatDate, followUp.afterDays),
      label: `Follow up with ${contact.name}: ${followUp.reason}`,
    });
  }
  return tasks;
}
