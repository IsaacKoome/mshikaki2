// components/event-sections/EventCommunityMembersSection.tsx
"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { UsersIcon, ChevronDownIcon } from "lucide-react"; // Corrected: removed UserIcon, keeping UsersIcon
import Link from 'next/link';


interface EventData {
  title: string;
  location: string;
  images: string[];
  videos?: string[];
  goal: number;
  raised?: number;
  story?: string;
  date?: string;
  contributionNote?: string;
  beneficiaryPhone?: string;
  ownerId?: string;
  [key: string]: any;
}

interface Participant {
  uid: string;
  displayName: string;
  photoURL?: string;
  isOwner: boolean;
}

interface CurrentUser {
  uid: string;
  displayName?: string | null;
  photoURL?: string | null;
}

interface EventCommunityMembersSectionProps {
  eventId: string;
  collectionName: "weddings" | "birthdays" | "babyshowers";
  eventData: EventData;
  currentUser: CurrentUser | null;
  communityParticipants: Participant[];
}

export default function EventCommunityMembersSection({
  eventId,
  collectionName,
  eventData,
  currentUser,
  communityParticipants,
}: EventCommunityMembersSectionProps) {
  const [showParticipants, setShowParticipants] = useState(true);

  return (
    <section className="bg-emerald-50 shadow-inner p-6 rounded-2xl border border-emerald-200 space-y-4">
        <Collapsible open={showParticipants} onOpenChange={setShowParticipants}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-lg">
                    <UsersIcon className="w-6 h-6 text-emerald-700" /> {/* Corrected to UsersIcon */}
                    Community Members ({communityParticipants.length})
                </div>
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-emerald-700 hover:text-emerald-900">
                        <ChevronDownIcon className={`w-5 h-5 transform transition-transform ${showParticipants ? "rotate-180" : ""}`} />
                    </Button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-4">
                {communityParticipants.length === 0 ? (
                    <p className="text-gray-500 italic text-center py-4">No members in this community yet. Be the first to send a message in chat!</p>
                ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {communityParticipants.map(participant => (
                            <li key={participant.uid}>
                                <Link href={`/users/${participant.uid}`} passHref className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md hover:bg-emerald-100 transition-all duration-200">
                                    <Image
                                        src={participant.photoURL || '/default-avatar.png'}
                                        alt={participant.displayName}
                                        width={40}
                                        height={40}
                                        className="rounded-full object-cover border-2 border-emerald-400 flex-shrink-0"
                                    />
                                    <div className="flex flex-col flex-grow">
                                        <span className="font-semibold text-gray-800 group-hover:text-emerald-900">
                                            {participant.displayName}
                                        </span>
                                        {participant.isOwner && (
                                            <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full font-semibold mt-1 self-start">
                                                Event Owner
                                            </span>
                                        )}
                                    </div>
                                    <UsersIcon className="w-5 h-5 text-gray-400 flex-shrink-0 ml-auto" /> {/* Corrected to UsersIcon */}
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </CollapsibleContent>
        </Collapsible>
    </section>
  );
}
