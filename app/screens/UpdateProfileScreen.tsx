import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Input } from '../../components/ui';
import { theme } from '../../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const UpdateProfileScreen: React.FC<any> = ({ navigation }) => {
	const { user, updateUser } = useAuth();
	const { showToast } = useToast();

	const [firstName, setFirstName] = useState(user?.first_name ?? '');
	const [lastName, setLastName] = useState(user?.last_name ?? '');
	const [company, setCompany] = useState((user as any)?.company ?? '');
	const [phone, setPhone] = useState((user as any)?.phone ?? '');
	const [saving, setSaving] = useState(false);

	const displayName = useMemo(() => {
		if (firstName && lastName) return `${firstName} ${lastName}`;
		return user?.username ?? user?.email ?? 'Profile';
	}, [firstName, lastName, user?.username, user?.email]);

	const handleSave = async () => {
		try {
			setSaving(true);
			const payload = {
				first_name: firstName,
				last_name: lastName,
				company,
				phone,
			} as any;

			const result = await updateUser(payload);
			if (result.success) {
				showToast('Profile updated successfully', 'success');
				navigation.goBack();
			} else if (result.error) {
				showToast(result.error, 'error');
			}
		} catch (error) {
			showToast(error, 'error');
		} finally {
			setSaving(false);
		}
	};

	return (
		<LinearGradient colors={[theme.colors.primary, theme.colors.secondary]} style={styles.container}>
			<StatusBar barStyle="light-content" />
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<Card style={styles.card}>
					<Text style={styles.title}>Update Profile</Text>
					<Text style={styles.subtitle}>Editing profile for {displayName}</Text>

					<Input
						label="First Name"
						value={firstName}
						onChangeText={setFirstName}
						autoCapitalize="words"
						style={styles.input}
					/>

					<Input
						label="Last Name"
						value={lastName}
						onChangeText={setLastName}
						autoCapitalize="words"
						style={styles.input}
					/>

					<Input
						label="Company"
						value={company}
						onChangeText={setCompany}
						autoCapitalize="words"
						style={styles.input}
					/>

					<Input
						label="Phone"
						value={phone}
						onChangeText={setPhone}
						keyboardType="phone-pad"
						style={styles.input}
					/>

					<View style={styles.buttonRow}>
						<Button
							title="Cancel"
							variant="outline"
							onPress={() => navigation.goBack()}
							style={styles.button}
						/>
						<Button
							title="Save Changes"
							onPress={handleSave}
							loading={saving}
							disabled={saving}
							style={styles.button}
						/>
					</View>
				</Card>
			</ScrollView>
		</LinearGradient>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	content: {
		paddingHorizontal: 20,
		paddingVertical: 32,
	},
	card: {
		padding: 24,
		gap: 16,
	},
	title: {
		fontSize: 24,
		fontWeight: '600',
		color: theme.colors.textPrimary,
	},
	subtitle: {
		fontSize: 14,
		color: theme.colors.textMuted,
	},
	input: {
		marginTop: 4,
	},
	buttonRow: {
		flexDirection: 'row',
		gap: 12,
		marginTop: 16,
	},
	button: {
		flex: 1,
	},
});

export default UpdateProfileScreen;
