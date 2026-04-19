"use client"

import { useEffect, useState } from "react"
import { AlignEndHorizontal, Plus } from "lucide-react"

type GroupSummary = {
  groupID: string;
  groupName: string;
}

type PollChoice = {
  text: string;
  count: number;
  voters?: string[];
}

type PollSummary = {
  pollId: string;
  question: string;
  choices: PollChoice[];
  endsAt: Date;
}

export default function GroupPollsPanel({ activeGroup, userId, isLeader }: { activeGroup: GroupSummary | null, userId: string, isLeader: boolean }) {
  const [polls, setPolls] = useState<PollSummary[]>([]);
  const [loadingPolls, setLoadingPolls] = useState(false);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, number | null>>({});
  const [showCreatePoll, setShowCreatePoll] = useState(false);

  const [question, setQuestion] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [newChoices, setNewChoices] = useState(["", ""]);

  const handleChoiceSelect = (pollId: string, choiceIndex: number) => {
    setSelectedChoices((prev) => {
      const poll = polls.find((p) => p.pollId === pollId);
      if (!poll) return prev;

      const votedIndex = getUserVote(poll);

      const currentSelected =
        Object.prototype.hasOwnProperty.call(prev, pollId)
          ? prev[pollId]
          : votedIndex;

      return {
        ...prev,
        [pollId]: currentSelected === choiceIndex ? null : choiceIndex,
      };
    });
  };

  const handleAddChoice = () => {
    setNewChoices((prev) => [...prev, ""]);
  };

  const handleRemoveChoice = (index: number) => {
    if (newChoices.length <= 2) return;
    setNewChoices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChoiceChange = (index: number, value: string) => {
    setNewChoices((prev) =>
      prev.map((choice, i) => (i === index ? value : choice))
    );
  };

  const handleCreatePoll = async () => {
    if (!activeGroup?.groupID) return;

    if (!question) {
      alert("Please enter a poll question.");
      return;
    }

    if (newChoices.length < 2) {
      alert("Please add at least 2 choices.");
      return;
    }

    if (!endsAt) {
      alert("Please choose an end time.");
      return;
    }

    try {
      const res = await fetch(`/api/groups/${activeGroup.groupID}/polls`, {
        method: "POST",
        body: JSON.stringify({
          question: question,
          choices: newChoices,
          endsAt: endsAt,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error?.[0].message || "Failed to create poll");
        return;
      }

      setPolls((prev) => [data.polls, ...prev]);

      setQuestion("");
      setEndsAt("");
      setNewChoices(["", ""]);
      setShowCreatePoll(false);
    } catch {
      alert("Failed to create poll");
    }
  };

  const handleVoteSubmit = async (pollId: string) => {
    if (!activeGroup?.groupID) return;

    const poll = polls.find((p) => p.pollId === pollId);
    if (!poll) return;

    const votedIndex = getUserVote(poll);
    const selected = Object.prototype.hasOwnProperty.call(selectedChoices, pollId) ? selectedChoices[pollId] : votedIndex;

    try {
      const res = await fetch(`/api/groups/${activeGroup.groupID}/polls/vote`, {
        method: "POST",
        body: JSON.stringify({
          pollId,
          choiceIndex: selected,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to submit vote");
        return;
      }

      // If backend returns updated poll
      if (data.poll) {
        setPolls((prev) =>
          prev.map((poll) => (poll.pollId === pollId ? data.poll : poll))
        );
      }

      setSelectedChoices((prev) => {
        const updated = { ...prev };
        delete updated[pollId];
        return updated;
      });
    } catch {
      alert("Failed to submit vote");
    }
  };

  const handleDelete = async (pollId: string) => {
    try {
      const res = await fetch(`/api/groups/${activeGroup?.groupID}/polls`, {
        method: "DELETE",
        body: JSON.stringify({ pollId: pollId })
      })

      if (!res.ok) return;

      setPolls((prev) => prev.filter((poll) => poll.pollId !== pollId))
    } catch {

    }
  };

  const getUserVote = (poll: PollSummary) => {
    return poll.choices.findIndex((choice) => (choice.voters ?? []).includes(userId));
  }

  useEffect(() => {
    const fetchPolls = async () => {
      if (!activeGroup?.groupID) return;

      setLoadingPolls(true);
      try {
        const res = await fetch(`/api/groups/${activeGroup.groupID}/polls`);
        const data = await res.json();

        if (!res.ok) return;

        setPolls(data.polls ?? []);
      } catch {

      } finally {
        setLoadingPolls(false);
      }
    }

    fetchPolls();
  }, [activeGroup?.groupID]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <section className="flex-1 space-y-4 h-full flex flex-col justify-between">
          <div className="flex items-center gap-3 px-2">
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <AlignEndHorizontal size={20} />
            </div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              Polls
            </h2>
          </div>
        </section>
        <button
          type="button"
          onClick={() => setShowCreatePoll((prev) => !prev)}
          className="ml-auto flex items-center gap-2 bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-2 px-4 rounded-2xl shadow-lg shadow-amber-200 transition-all active:scale-95"
        >
          <Plus size={20} />
          {showCreatePoll ? "Close" : "Create Poll"}
        </button>
      </div>

      {showCreatePoll && (
        <div className="mt-6 bg-white rounded-3xl border border-gray-200 shadow-sm p-6">
          <div className="mb-5">
            <h3 className="text-xl font-bold text-gray-900">New Poll</h3>
            <p className="text-sm text-gray-500">
              Ask your group a question and collect votes.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Question
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Where should we eat tonight?"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:border-amber-300 focus:ring-4 focus:ring-amber-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Options
              </label>
              <div className="space-y-3">
                {newChoices.map((choice, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <input
                      type="text"
                      value={choice}
                      onChange={(e) => handleChoiceChange(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:border-amber-300 focus:ring-4 focus:ring-amber-100 transition-all"
                    />

                    <button
                      type="button"
                      onClick={() => handleRemoveChoice(index)}
                      disabled={newChoices.length <= 2}
                      className="h-11 w-11 rounded-2xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddChoice}
                className="mt-3 text-sm font-bold text-amber-600 hover:text-amber-700 transition-colors"
              >
                + Add another option
              </button>
            </div>

            <div className="max-w-xs">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ends At
              </label>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:border-amber-300 focus:ring-4 focus:ring-amber-100 transition-all"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreatePoll(false)}
                className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => handleCreatePoll()}
                className="px-5 py-3 rounded-2xl bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold shadow-md transition-all active:scale-95"
              >
                Create Poll
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {loadingPolls ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            Loading Polls...
          </div>
        ) : activeGroup && polls.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {polls.map((p) => {
              const ends = new Date(p.endsAt);
              const isExpired = ends.getTime() < Date.now();
              const votedIndex = getUserVote(p);
              const selected = Object.prototype.hasOwnProperty.call(selectedChoices, p.pollId) ? selectedChoices[p.pollId] : votedIndex;

              return (
                <div
                  key={p.pollId}
                  className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 truncate">
                        {p.question}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {isExpired ? "Poll ended" : "Open for voting"}
                      </p>
                    </div>

                    <div
                      className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold border ${isExpired
                        ? "bg-gray-100 text-gray-500 border-gray-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                    >
                      {isExpired ? "Closed" : "Active"}
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    {p.choices.map((choice, idx) => {
                      const isSelected = selected === idx;

                      return (
                        <button
                          key={`${p.pollId}-${idx}`}
                          type="button"
                          onClick={() => !isExpired && handleChoiceSelect(p.pollId, idx)}
                          className={`w-full text-left rounded-2xl border px-4 py-3 transition-all ${isSelected
                            ? "border-amber-300 bg-amber-50 ring-2 ring-amber-100"
                            : "border-gray-200 bg-gray-50 hover:border-amber-200 hover:bg-amber-50/40"
                            } ${isExpired ? "cursor-not-allowed opacity-70" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium text-gray-800">{choice.text}</span>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-500">
                                {choice.count} vote{choice.count === 1 ? "" : "s"}
                              </span>

                              {isSelected && (
                                <span className="text-xs font-bold text-amber-700">
                                  Selected
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
                      Ends{" "}
                      {ends.toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>

                    <div className="flex items-center gap-2">
                      {!isExpired && (
                        <button
                          type="button"
                          onClick={() => handleVoteSubmit(p.pollId)}
                          className="px-4 py-2 rounded-xl bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {
                            selected === null && votedIndex !== -1
                              ? "Remove Vote"
                              : votedIndex !== -1
                                ? "Update Vote"
                                : "Vote"
                          }
                        </button>
                      )}

                      {isLeader && (
                        <button
                          type="button"
                          onClick={() => handleDelete(p.pollId)}
                          className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-semibold hover:bg-gray-50 hover:border-gray-300 transition-all"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-center text-gray-500">
            <div>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                <AlignEndHorizontal size={28} />
              </div>
              <p className="font-medium text-gray-700 mb-1">
                No polls yet
              </p>
              <p className="text-sm text-gray-500">
                Be the first to create one!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}