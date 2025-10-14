import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Input } from '../../components/ui';
import { theme } from '../../constants/theme';
import { apiService } from '../../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const ChangePasswordScreen: React.FC<any> = ({ navigation }) => {
	const { user } = useAuth();
	const { showToast } = useToast();

	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async () => {
		if (!currentPassword || !newPassword || !confirmPassword) {
			showToast('Please complete all fields', 'warning');
			return;
		}

		if (newPassword !== confirmPassword) {
			showToast('New passwords do not match', 'error');
			return;
		}

		try {
			setSubmitting(true);
			await apiService.changePassword({
				old_password: currentPassword,
				new_password: newPassword,
			});
			showToast('Password updated successfully', 'success');
			navigation.goBack();
		} catch (error) {
			showToast(error, 'error');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<LinearGradient colors={[theme.colors.primary, theme.colors.secondary]} style={styles.container}>
			<StatusBar barStyle="light-content" />
			<Card style={styles.card}>
				<Text style={styles.title}>Change Password</Text>
				<Text style={styles.subtitle}>
					{user?.email ? `Signed in as ${user.email}` : 'Update your account password'}
				</Text>

				<Input
					label="Current Password"
					value={currentPassword}
					onChangeText={setCurrentPassword}
					secureTextEntry
					autoCapitalize="none"
					autoCorrect={false}
					style={styles.input}
				/>

				<Input
					label="New Password"
					value={newPassword}
					onChangeText={setNewPassword}
					secureTextEntry
					autoCapitalize="none"
					autoCorrect={false}
					style={styles.input}
				/>

				<Input
					label="Confirm New Password"
					value={confirmPassword}
					onChangeText={setConfirmPassword}
					secureTextEntry
					autoCapitalize="none"
					autoCorrect={false}
					style={styles.input}
				/>

				<Button
					title="Update Password"
					onPress={handleSubmit}
					loading={submitting}
					disabled={submitting}
					style={styles.submitButton}
				/>

				<Button
					title="Back"
					variant="outline"
					onPress={() => navigation.goBack()}
				/>
			</Card>
		</LinearGradient>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingHorizontal: 20,
		paddingVertical: 32,
		justifyContent: 'center',
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
	submitButton: {
		marginTop: 8,
	},
});

export default ChangePasswordScreen;
