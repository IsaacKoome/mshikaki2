// components/event-sections/EventContributionsSection.tsx
"use client";

import React, { useState, useEffect } from 'react'; // Added useEffect for potential future use or consistency
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { InfoIcon, ChevronDownIcon } from "lucide-react";
import { Timestamp, collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";


// Interfaces for props received from EventDetailPage
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
  beneficiaryPhone?: string; // Crucial for Mpesa
  ownerId?: string;
  [key: string]: any;
}

interface Contribution {
  id: string;
  amount: number;
  name: string;
  phone: string;
  timestamp: Timestamp;
  mpesaReceiptNumber?: string;
  status?: string;
}

interface CurrentUser {
  uid: string;
  displayName?: string | null;
  photoURL?: string | null;
}

interface EventContributionsSectionProps {
  eventId: string;
  collectionName: "weddings" | "birthdays" | "babyshowers";
  eventData: EventData; // Full event data passed as prop
  currentUser: CurrentUser | null; // Authenticated user data
  contributionsTotal: number; // Data passed from parent
  contributionList: Contribution[]; // Data passed from parent
}

export default function EventContributionsSection({
  eventId,
  collectionName,
  eventData,
  currentUser,
  contributionsTotal,
  contributionList,
}: EventContributionsSectionProps) {
  const [amount, setAmount] = useState<number | "">(0);
  // Pre-fill with current user's name if available, otherwise empty
  const [name, setName] = useState(currentUser?.displayName || "");
  const [phone, setPhone] = useState(""); // User will manually enter phone
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showNote, setShowNote] = useState(false); // State for collapsible contribution note

  const [mpesaStatus, setMpesaStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [mpesaMessage, setMpesaMessage] = useState<string | null>(null);
  const [isSubmittingGift, setIsSubmittingGift] = useState(false);

  // Helper to mask phone numbers for display
  const maskPhone = (phone: string) => {
    return phone.length >= 7
      ? phone.slice(0, 2) + "***" + phone.slice(-2)
      : "07***00"; // Fallback for very short or empty numbers
  };

  const handleContribute = async () => {
    if (!amount || amount <= 0 || !name || !phone) {
      alert("Please fill in all fields correctly.");
      return;
    }
    // eventData is guaranteed non-null due to EventDetailPage's guard
    if (!eventData.beneficiaryPhone) {
        alert("This event does not have a beneficiary Mpesa number set up for receiving gifts.");
        return;
    }

    setIsSubmittingGift(true);
    setMpesaStatus('pending');
    setMpesaMessage('Initiating Mpesa STK Push...');

    try {
        const response = await fetch('/api/mpesa/stkpush', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: Number(amount),
                phone: phone, // Contributor's phone number
                eventId: eventId, // ID of the event
                collectionName: collectionName, // Pass collectionName for callback route
                eventOwnerId: eventData.ownerId, // Event creator's UID
                contributorName: name, // Contributor's name
                beneficiaryPhone: eventData.beneficiaryPhone, // Beneficiary's Mpesa number (from event data)
            }),
        });

        const data = await response.json();

        if (response.ok) {
            setMpesaStatus('success');
            setMpesaMessage('Mpesa STK Push sent! Please enter your Mpesa PIN on your phone.');
        } else {
            setMpesaStatus('failed');
            setMpesaMessage(data.message || 'Failed to initiate Mpesa STK Push.');
        }

    } catch (error) {
        console.error("Error during STK Push API call:", error);
        setMpesaStatus('failed');
        setMpesaMessage('Network error or server issue. Please try again.');
    } finally {
        setIsSubmittingGift(false);
    }
  };

  const resetMpesaFlow = () => {
    setAmount(0);
    setPhone("");
    setMpesaStatus('idle');
    setMpesaMessage(null);
    setDialogOpen(false);
  };

  const goal = eventData.goal || 100000;
  const progress = Math.min((contributionsTotal / goal) * 100, 100);

  return (
    <div className="space-y-8">
      {/* Progress Bar & Gift Button Section */}
      <section className="space-y-4 text-center p-6 bg-white rounded-2xl shadow-lg border border-gray-100">
        <h2 className="text-2xl font-bold text-rose-700">Progress Towards Goal</h2>
        <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden shadow-inner">
          <div
            className="bg-gradient-to-r from-green-400 to-emerald-500 h-full rounded-full transition-all duration-500 ease-out flex items-center justify-end px-2"
            style={{ width: `${progress}%` }}
          >
            <span className="text-xs font-bold text-white drop-shadow-sm">
              {progress.toFixed(0)}%
            </span>
          </div>
        </div>
        <p className="text-lg font-semibold text-gray-700">
          KES {contributionsTotal.toLocaleString()} raised of KES {goal.toLocaleString()}
        </p>

        {/* Contribute Modal Trigger Button */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="mt-4 bg-rose-600 hover:bg-rose-700 px-8 py-4 text-lg font-bold rounded-full shadow-lg transition-all duration-300 transform hover:scale-105">
              🎁 Send Gift
            </Button>
          </DialogTrigger>
          <DialogContent className="space-y-5 max-w-sm w-full mx-auto p-7 rounded-3xl shadow-xl z-50 bg-white border-rose-200">
            <DialogTitle className="text-center text-rose-700 font-extrabold text-2xl">
              🎁 Send Your Gift
            </DialogTitle>

            {/* MPESA STATUS FEEDBACK */}
            {mpesaStatus !== 'idle' && (
              <div className={`p-4 rounded-lg text-base text-center font-medium
                ${mpesaStatus === 'pending' ? 'bg-blue-100 text-blue-800 border border-blue-200' : ''}
                ${mpesaStatus === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : ''}
                ${mpesaStatus === 'failed' ? 'bg-red-100 text-red-800 border border-red-200' : ''}`
              }>
                {mpesaMessage}
              </div>
            )}

            {/* Gift form - hidden if Mpesa process is successful and awaiting callback */}
            {mpesaStatus !== 'success' && (
              <>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  disabled={isSubmittingGift}
                  className="border-gray-300 focus:border-rose-500 focus:ring-rose-500 rounded-lg p-3"
                />
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone (e.g., 0712345678)"
                  disabled={isSubmittingGift}
                  className="border-gray-300 focus:border-rose-500 focus:ring-rose-500 rounded-lg p-3"
                />
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="KES"
                  min="1"
                  disabled={isSubmittingGift}
                  className="border-gray-300 focus:border-rose-500 focus:ring-rose-500 rounded-lg p-3"
                />

                <Button onClick={handleContribute} className="w-full bg-rose-600 hover:bg-rose-700 py-3 text-lg font-semibold rounded-lg shadow-md" disabled={isSubmittingGift}>
                  {isSubmittingGift ? "Sending..." : "Submit Gift"}
                </Button>
              </>
            )}

            {/* Dialog Footer for closing */}
            {(mpesaStatus === 'success' || mpesaStatus === 'failed') && (
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={resetMpesaFlow} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg">
                  Close
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </section>

      {/* Contribution Note (if available in eventData) */}
      {eventData.contributionNote && (
          <section className="bg-yellow-50 border border-yellow-300 rounded-2xl p-5 shadow-inner">
            <Collapsible open={showNote} onOpenChange={setShowNote}>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-yellow-800 font-bold text-lg">
                        <InfoIcon className="w-6 h-6 text-yellow-700" />
                        Why Support This Event?
                    </div>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-yellow-700 hover:text-yellow-900">
                            <ChevronDownIcon className={`w-5 h-5 transform transition-transform ${showNote ? "rotate-180" : ""}`} />
                        </Button>
                    </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="text-base text-gray-700 whitespace-pre-line mt-1 leading-relaxed">
                    {eventData.contributionNote}
                </CollapsibleContent>
            </Collapsible>
          </section>
      )}

      {/* Contribution List Section */}
      <section className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
        <h2 className="text-2xl font-bold text-rose-700 mb-4">All Gifts Received</h2>
        <ul className="space-y-3">
          {contributionList.length === 0 ? (
            <p className="text-gray-500 italic text-center py-4">No contributions yet. Be the first to send a gift!</p>
          ) : (
            contributionList.map((c) => (
              <li key={c.id} className="text-base text-gray-700 flex items-center justify-between p-3 bg-gray-50 rounded-lg shadow-sm border border-gray-100">
                <span className="font-medium text-gray-800">{c.name || "Anonymous"}</span>
                <span className="text-gray-600 ml-2">({maskPhone(c.phone || "")})</span>
                <span className="font-semibold text-rose-600 ml-auto">KES {c.amount?.toLocaleString()}</span>
                {c.status && (
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold
                    ${c.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : ''}
                    ${c.status === 'PENDING' ? 'bg-blue-100 text-blue-800' : ''}
                    ${c.status === 'FAILED' || c.status === 'CANCELLED' ? 'bg-red-100 text-red-800' : ''}`
                  }>
                    {c.status}
                  </span>
                )}
                {c.mpesaReceiptNumber && (
                  <span className="ml-2 text-xs text-gray-500">Ref: {c.mpesaReceiptNumber}</span>
                )}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
